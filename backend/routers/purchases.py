import sqlite3
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import get_db

router = APIRouter()


class PurchaseCreate(BaseModel):
    jan_code: str
    price: int = Field(ge=1)
    quantity: int = Field(ge=1, le=999)
    purchased_at: date
    store_name: str | None = None
    remaining_doses: int | None = Field(default=None, ge=0)


@router.post("/purchases")
def add_purchase(
    body: PurchaseCreate, db: sqlite3.Connection = Depends(get_db)
):
    product = db.execute(
        "SELECT * FROM products WHERE jan_code = ?", [body.jan_code]
    ).fetchone()
    if product is None:
        raise HTTPException(status_code=404, detail="商品が見つかりません")

    cursor = db.execute(
        "INSERT INTO purchases (jan_code, price, quantity, purchased_at, store_name, remaining_doses) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        [body.jan_code, body.price, body.quantity,
         body.purchased_at.isoformat(), body.store_name, body.remaining_doses],
    )
    db.commit()

    row = db.execute(
        "SELECT p.*, prod.name AS product_name, prod.is_qualified "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE p.id = ?",
        [cursor.lastrowid],
    ).fetchone()
    return dict(row)


@router.get("/purchases")
def list_purchases(year: int, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT p.*, prod.name AS product_name, prod.is_qualified "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE strftime('%Y', p.purchased_at) = ? "
        "ORDER BY p.purchased_at DESC",
        [str(year)],
    ).fetchall()
    return [dict(r) for r in rows]
