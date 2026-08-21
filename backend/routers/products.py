import sqlite3
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from condition_catalog import matching_condition_labels
from db import get_db
from symptom_categories import CATEGORY_PRODUCT_TERMS, FILTER_KEYWORDS

router = APIRouter()


class ProductSearchRequest(BaseModel):
    symptoms: list[str] = Field(min_length=1)
    filters: list[str] = Field(default_factory=list)
    current_meds: list[str] = Field(default_factory=list)
    conditions: list[str] = Field(default_factory=list)


class ProductOut(BaseModel):
    jan_code: str
    name: str
    generic_name: str
    efficacy: str
    dosage: str
    side_effects: str
    precautions: str
    pdf_url: str
    price: int
    category: str
    is_qualified: bool
    overlap_warning: bool
    condition_warnings: list[str] = Field(default_factory=list)
    vendor_min_price: int | None = None
    vendor_max_price: int | None = None
    vendor_count: int = 0
    price_note: str = "店舗横断の参考最安。最新価格は各購入ページで確認してください。"


class ProductFindOut(BaseModel):
    """購入記録用の商品名検索結果。"""
    jan_code: str
    name: str
    generic_name: str
    efficacy: str
    dosage: str
    side_effects: str
    precautions: str
    pdf_url: str
    price: int
    category: str
    is_qualified: int


class VendorOut(BaseModel):
    store_name: str
    price: int
    in_stock: bool  # 互換用。在庫連動は行わず常に True
    url: str
    is_lowest: bool = False
    price_note: str = "参考価格。最新価格は購入ページでご確認ください。"


class PriceCompareOut(BaseModel):
    jan_code: str
    product_name: str
    min_price: int
    max_price: int
    vendors: list[VendorOut]
    disclaimer: str


def _fetch_past_purchase_names(db: sqlite3.Connection) -> list[str]:
    one_year_ago = (date.today() - timedelta(days=365)).isoformat()
    rows = db.execute(
        "SELECT DISTINCT prod.name FROM purchases p "
        "JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE p.purchased_at >= ? ORDER BY p.purchased_at DESC LIMIT 10",
        [one_year_ago],
    ).fetchall()
    return [r["name"] for r in rows]


def _row_to_find_out(r: sqlite3.Row) -> ProductFindOut:
    return ProductFindOut(
        jan_code=r["jan_code"],
        name=r["name"],
        generic_name=r["generic_name"],
        efficacy=r["efficacy"],
        dosage=r["dosage"],
        side_effects=r["side_effects"],
        precautions=r["precautions"],
        pdf_url=r["pdf_url"],
        price=r["price"],
        category=r["category"],
        is_qualified=int(r["is_qualified"]),
    )


@router.get("/products/find", response_model=list[ProductFindOut])
def find_products_by_name(
    q: str = Query(min_length=1, max_length=80),
    db: sqlite3.Connection = Depends(get_db),
) -> list[ProductFindOut]:
    """商品名・一般名・カテゴリの部分一致検索（購入記録用）。"""
    keyword = q.strip()
    if not keyword:
        return []
    like = f"%{keyword}%"
    rows = db.execute(
        "SELECT * FROM products "
        "WHERE name LIKE ? OR generic_name LIKE ? OR category LIKE ? "
        "ORDER BY "
        "  CASE WHEN name LIKE ? THEN 0 "
        "       WHEN name LIKE ? THEN 1 "
        "       ELSE 2 END, "
        "  price ASC, name ASC "
        "LIMIT 30",
        [like, like, like, keyword, f"{keyword}%"],
    ).fetchall()
    return [_row_to_find_out(r) for r in rows]


@router.post("/products/search", response_model=list[ProductOut])
def search_products(body: ProductSearchRequest, db: sqlite3.Connection = Depends(get_db)) -> list[ProductOut]:
    terms: set[str] = set()
    for symptom in body.symptoms:
        terms.update(CATEGORY_PRODUCT_TERMS.get(symptom, []))

    rows = db.execute("SELECT * FROM products").fetchall()
    matched = [r for r in rows if any(t in r["efficacy"] for t in terms)]

    active_filters = [f for f in body.filters if f in FILTER_KEYWORDS]
    if active_filters:
        filter_words = [w for f in active_filters for w in FILTER_KEYWORDS[f]]
        matched = [
            r for r in matched
            if any(w in r["name"] or w in r["generic_name"] or w in r["efficacy"] for w in filter_words)
        ]

    if "過去購入品を優先" in body.filters:
        past_names = set(_fetch_past_purchase_names(db))
        matched.sort(key=lambda r: (r["name"] not in past_names, r["price"], r["generic_name"]))
    else:
        matched.sort(key=lambda r: (r["price"], r["generic_name"]))

    results: list[ProductOut] = []
    for r in matched:
        price_row = db.execute(
            "SELECT MIN(price) AS min_p, MAX(price) AS max_p, COUNT(*) AS cnt "
            "FROM vendor_listings WHERE jan_code = ?",
            [r["jan_code"]],
        ).fetchone()
        min_p = price_row["min_p"] if price_row else None
        max_p = price_row["max_p"] if price_row else None
        cnt = int(price_row["cnt"] or 0) if price_row else 0
        display_price = int(min_p) if min_p is not None else r["price"]
        results.append(
            ProductOut(
                jan_code=r["jan_code"],
                name=r["name"],
                generic_name=r["generic_name"],
                efficacy=r["efficacy"],
                dosage=r["dosage"],
                side_effects=r["side_effects"],
                precautions=r["precautions"],
                pdf_url=r["pdf_url"],
                price=display_price,
                category=r["category"],
                is_qualified=bool(r["is_qualified"]),
                overlap_warning=any(med in r["generic_name"] for med in body.current_meds),
                condition_warnings=matching_condition_labels(
                    r["precautions"] or "", body.conditions
                ),
                vendor_min_price=int(min_p) if min_p is not None else None,
                vendor_max_price=int(max_p) if max_p is not None else None,
                vendor_count=cnt,
            )
        )
    return results


def _vendor_rows(db: sqlite3.Connection, jan_code: str) -> list[VendorOut]:
    rows = db.execute(
        "SELECT store_name, price, in_stock, url FROM vendor_listings "
        "WHERE jan_code = ? ORDER BY price ASC, store_name",
        [jan_code],
    ).fetchall()
    if not rows:
        return []
    min_price = rows[0]["price"]
    return [
        VendorOut(
            store_name=r["store_name"],
            price=r["price"],
            in_stock=True,
            url=r["url"],
            is_lowest=r["price"] == min_price,
        )
        for r in rows
    ]


@router.get("/products/{jan_code}/vendors", response_model=list[VendorOut])
def get_vendors(jan_code: str, db: sqlite3.Connection = Depends(get_db)) -> list[VendorOut]:
    product = db.execute("SELECT jan_code FROM products WHERE jan_code = ?", [jan_code]).fetchone()
    if product is None:
        raise HTTPException(status_code=404, detail="この商品は登録されていません")
    return _vendor_rows(db, jan_code)


@router.get("/products/{jan_code}/price-compare", response_model=PriceCompareOut)
def price_compare(jan_code: str, db: sqlite3.Connection = Depends(get_db)) -> PriceCompareOut:
    """店舗横断の参考価格比較。在庫は扱わない。"""
    product = db.execute(
        "SELECT jan_code, name FROM products WHERE jan_code = ?", [jan_code]
    ).fetchone()
    if product is None:
        raise HTTPException(status_code=404, detail="この商品は登録されていません")

    vendors = _vendor_rows(db, jan_code)
    if not vendors:
        raise HTTPException(status_code=404, detail="価格情報がありません")

    prices = [v.price for v in vendors]
    return PriceCompareOut(
        jan_code=product["jan_code"],
        product_name=product["name"],
        min_price=min(prices),
        max_price=max(prices),
        vendors=vendors,
        disclaimer=(
            "表示は参考価格です。在庫状況は扱いません。"
            "最新の販売価格は各購入ページでご確認ください。"
        ),
    )
