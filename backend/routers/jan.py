import sqlite3
from fastapi import APIRouter, Depends, HTTPException
from db import get_db

router = APIRouter()


@router.get("/jan/{code}")
def lookup_jan(code: str, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT * FROM products WHERE jan_code = ?", [code]
    ).fetchone()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail="この商品は登録されていません。手動で追加できます。",
        )
    return dict(row)
