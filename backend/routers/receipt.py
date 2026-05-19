import sqlite3
from datetime import date
from fastapi import APIRouter, Depends
from db import get_db

router = APIRouter()

_MOCK_ITEMS = [
    {"jan_code": "4987117709559", "price": 980,  "store": "マツキヨ渋谷店"},
    {"jan_code": "4987028112014", "price": 1280, "store": "マツキヨ渋谷店"},
]


@router.post("/receipt/upload")
def upload_receipt(db: sqlite3.Connection = Depends(get_db)):
    today = date.today().isoformat()
    imported = 0
    for item in _MOCK_ITEMS:
        exists = db.execute(
            "SELECT jan_code FROM products WHERE jan_code = ?", [item["jan_code"]]
        ).fetchone()
        if not exists:
            continue
        db.execute(
            "INSERT INTO purchases (jan_code, price, quantity, purchased_at, store_name) VALUES (?,?,?,?,?)",
            [item["jan_code"], item["price"], 1, today, item["store"]],
        )
        imported += 1
    db.commit()
    return {"imported": imported, "date": today, "store": "マツキヨ渋谷店"}
