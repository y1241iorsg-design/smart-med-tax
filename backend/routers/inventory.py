import sqlite3
from fastapi import APIRouter, Depends
from db import get_db

router = APIRouter()

LOW_STOCK_THRESHOLD = 3


@router.get("/inventory")
def get_inventory(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute("""
        SELECT
            p.jan_code,
            prod.name AS product_name,
            prod.category,
            p.remaining_doses,
            p.purchased_at
        FROM purchases p
        JOIN products prod ON p.jan_code = prod.jan_code
        WHERE p.remaining_doses IS NOT NULL
          AND p.id = (
              SELECT id FROM purchases p2
              WHERE p2.jan_code = p.jan_code AND p2.remaining_doses IS NOT NULL
              ORDER BY p2.purchased_at DESC, p2.id DESC
              LIMIT 1
          )
        ORDER BY prod.name
    """).fetchall()

    return [
        {
            "jan_code": r["jan_code"],
            "product_name": r["product_name"],
            "category": r["category"],
            "remaining_doses": r["remaining_doses"],
            "last_purchased_at": r["purchased_at"],
            "is_low_stock": r["remaining_doses"] <= LOW_STOCK_THRESHOLD,
        }
        for r in rows
    ]
