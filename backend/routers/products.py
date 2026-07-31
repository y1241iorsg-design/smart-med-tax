import sqlite3
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import get_db
from symptom_categories import CATEGORY_PRODUCT_TERMS, FILTER_KEYWORDS

router = APIRouter()


class ProductSearchRequest(BaseModel):
    symptoms: list[str] = Field(min_length=1)
    filters: list[str] = Field(default_factory=list)
    current_meds: list[str] = Field(default_factory=list)


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


class VendorOut(BaseModel):
    store_name: str
    price: int
    in_stock: bool
    url: str


def _fetch_past_purchase_names(db: sqlite3.Connection) -> list[str]:
    one_year_ago = (date.today() - timedelta(days=365)).isoformat()
    rows = db.execute(
        "SELECT DISTINCT prod.name FROM purchases p "
        "JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE p.purchased_at >= ? ORDER BY p.purchased_at DESC LIMIT 10",
        [one_year_ago],
    ).fetchall()
    return [r["name"] for r in rows]


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

    return [
        ProductOut(
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
            is_qualified=bool(r["is_qualified"]),
            overlap_warning=any(med in r["generic_name"] for med in body.current_meds),
        )
        for r in matched
    ]


@router.get("/products/{jan_code}/vendors", response_model=list[VendorOut])
def get_vendors(jan_code: str, db: sqlite3.Connection = Depends(get_db)) -> list[VendorOut]:
    product = db.execute("SELECT jan_code FROM products WHERE jan_code = ?", [jan_code]).fetchone()
    if product is None:
        raise HTTPException(status_code=404, detail="この商品は登録されていません")

    rows = db.execute(
        "SELECT store_name, price, in_stock, url FROM vendor_listings "
        "WHERE jan_code = ? ORDER BY price",
        [jan_code],
    ).fetchall()
    return [
        VendorOut(store_name=r["store_name"], price=r["price"], in_stock=bool(r["in_stock"]), url=r["url"])
        for r in rows
    ]
