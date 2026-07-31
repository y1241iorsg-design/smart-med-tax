import sqlite3
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import get_db

router = APIRouter()

FOLLOW_UP_STATUSES = ("改善", "変化なし", "悪化")
VISIT_MESSAGE = (
    "症状の改善が見られません。医療機関の受診をご検討ください。"
    "本サービスは診断を行うものではありません。"
)

PURCHASE_SELECT = (
    "SELECT p.*, prod.name AS product_name, prod.is_qualified, prod.category "
    "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
)


class PurchaseCreate(BaseModel):
    jan_code: str
    price: int = Field(ge=1)
    quantity: int = Field(ge=1, le=999)
    purchased_at: date
    store_name: str | None = None
    remaining_doses: int | None = Field(default=None, ge=0)
    purpose: str | None = None
    memo: str | None = None
    family_member_name: str | None = None


class PurchaseUpdate(BaseModel):
    price: int = Field(ge=1)
    quantity: int = Field(ge=1, le=999)
    purchased_at: date
    store_name: str | None = None
    purpose: str | None = None
    memo: str | None = None
    family_member_name: str = Field(min_length=1)


class FollowUpIn(BaseModel):
    status: str


def _fetch_purchase(db: sqlite3.Connection, purchase_id: int) -> dict:
    row = db.execute(PURCHASE_SELECT + "WHERE p.id = ?", [purchase_id]).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="購入記録が見つかりません")
    return dict(row)


@router.post("/purchases")
def add_purchase(body: PurchaseCreate, db: sqlite3.Connection = Depends(get_db)):
    product = db.execute(
        "SELECT * FROM products WHERE jan_code = ?", [body.jan_code]
    ).fetchone()
    if product is None:
        raise HTTPException(status_code=404, detail="商品が見つかりません")

    family_name = body.family_member_name or "自分"
    cursor = db.execute(
        "INSERT INTO purchases "
        "(jan_code, price, quantity, purchased_at, store_name, remaining_doses, purpose, memo, "
        " family_member_name, follow_up_status) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '未入力')",
        [
            body.jan_code, body.price, body.quantity, body.purchased_at.isoformat(),
            body.store_name, body.remaining_doses, body.purpose, body.memo, family_name,
        ],
    )
    db.commit()
    return _fetch_purchase(db, cursor.lastrowid)


@router.get("/purchases")
def list_purchases(year: int, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        PURCHASE_SELECT
        + "WHERE strftime('%Y', p.purchased_at) = ? ORDER BY p.purchased_at DESC",
        [str(year)],
    ).fetchall()
    return [dict(r) for r in rows]


@router.patch("/purchases/{purchase_id}")
def update_purchase(
    purchase_id: int, body: PurchaseUpdate, db: sqlite3.Connection = Depends(get_db)
):
    _fetch_purchase(db, purchase_id)
    db.execute(
        "UPDATE purchases SET price=?, quantity=?, purchased_at=?, store_name=?, "
        "purpose=?, memo=?, family_member_name=? WHERE id=?",
        [
            body.price, body.quantity, body.purchased_at.isoformat(), body.store_name,
            body.purpose, body.memo, body.family_member_name, purchase_id,
        ],
    )
    db.commit()
    return _fetch_purchase(db, purchase_id)


@router.delete("/purchases/{purchase_id}")
def delete_purchase(purchase_id: int, db: sqlite3.Connection = Depends(get_db)):
    _fetch_purchase(db, purchase_id)
    db.execute("DELETE FROM purchases WHERE id = ?", [purchase_id])
    db.commit()
    return {"ok": True}


@router.patch("/purchases/{purchase_id}/follow-up")
def update_follow_up(
    purchase_id: int, body: FollowUpIn, db: sqlite3.Connection = Depends(get_db)
):
    if body.status not in FOLLOW_UP_STATUSES:
        raise HTTPException(status_code=422, detail="status は 改善 / 変化なし / 悪化 のいずれかです")
    _fetch_purchase(db, purchase_id)
    today = date.today().isoformat()
    db.execute(
        "UPDATE purchases SET follow_up_status=?, follow_up_date=? WHERE id=?",
        [body.status, today, purchase_id],
    )
    db.commit()
    recommend = body.status in ("変化なし", "悪化")
    return {
        "id": purchase_id,
        "follow_up_status": body.status,
        "follow_up_date": today,
        "recommend_medical_visit": recommend,
        "message": VISIT_MESSAGE if recommend else "",
    }
