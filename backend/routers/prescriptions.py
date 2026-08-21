import sqlite3
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from data.rx_mock import RX_CATALOG
from db import get_db

router = APIRouter()


class RxCatalogOut(BaseModel):
    code: str
    name: str
    generic_name: str
    category: str


class PrescriptionIn(BaseModel):
    family_member_name: str = Field(min_length=1, max_length=40)
    rx_code: str = Field(min_length=1, max_length=20)
    started_at: str | None = None
    memo: str | None = None


class PrescriptionOut(BaseModel):
    id: int
    family_member_name: str
    rx_code: str
    name: str
    generic_name: str
    category: str
    started_at: str | None
    memo: str | None


def _catalog_by_code() -> dict[str, dict]:
    return {item["code"]: item for item in RX_CATALOG}


def _row_to_out(row: sqlite3.Row) -> PrescriptionOut:
    catalog = _catalog_by_code().get(row["rx_code"], {})
    return PrescriptionOut(
        id=row["id"],
        family_member_name=row["family_member_name"],
        rx_code=row["rx_code"],
        name=catalog.get("name", row["rx_code"]),
        generic_name=catalog.get("generic_name", ""),
        category=catalog.get("category", ""),
        started_at=row["started_at"],
        memo=row["memo"],
    )


@router.get("/prescriptions/catalog", response_model=list[RxCatalogOut])
def list_rx_catalog() -> list[RxCatalogOut]:
    return [RxCatalogOut(**item) for item in RX_CATALOG]


@router.get("/prescriptions", response_model=list[PrescriptionOut])
def list_prescriptions(
    family_member_name: str | None = None,
    db: sqlite3.Connection = Depends(get_db),
) -> list[PrescriptionOut]:
    if family_member_name:
        rows = db.execute(
            "SELECT * FROM prescriptions WHERE family_member_name = ? ORDER BY id DESC",
            [family_member_name],
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM prescriptions ORDER BY id DESC").fetchall()
    return [_row_to_out(r) for r in rows]


@router.post("/prescriptions", response_model=PrescriptionOut)
def create_prescription(
    body: PrescriptionIn, db: sqlite3.Connection = Depends(get_db)
) -> PrescriptionOut:
    if body.rx_code not in _catalog_by_code():
        raise HTTPException(status_code=400, detail="未登録の処方薬コードです")
    member = db.execute(
        "SELECT id FROM family_members WHERE name = ?", [body.family_member_name]
    ).fetchone()
    if member is None:
        raise HTTPException(status_code=400, detail="家族メンバーが見つかりません")
    cur = db.execute(
        "INSERT INTO prescriptions (family_member_name, rx_code, started_at, memo) "
        "VALUES (?, ?, ?, ?)",
        [body.family_member_name, body.rx_code, body.started_at, body.memo],
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM prescriptions WHERE id = ?", [cur.lastrowid]
    ).fetchone()
    return _row_to_out(row)


@router.delete("/prescriptions/{prescription_id}")
def delete_prescription(
    prescription_id: int, db: sqlite3.Connection = Depends(get_db)
):
    row = db.execute(
        "SELECT id FROM prescriptions WHERE id = ?", [prescription_id]
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="処方薬登録が見つかりません")
    db.execute("DELETE FROM prescriptions WHERE id = ?", [prescription_id])
    db.commit()
    return {"ok": True}
