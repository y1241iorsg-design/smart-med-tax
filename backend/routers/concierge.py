"""5.1 OTC コンシェルジュ — 専門家相談の予約フロー（実機能）。

専門家へ渡すのは事実データ（お薬手帳・家族の登録情報）のみ。
診断・安全性判定・推奨薬の選定は行わない。
"""

import json
import sqlite3
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import get_db

router = APIRouter()


class ExpertOut(BaseModel):
    id: int
    name: str
    title: str
    area: str
    rating: float


class SlotOut(BaseModel):
    id: int
    expert_id: int
    slot_at: str
    is_booked: bool


class BookingCreate(BaseModel):
    expert_id: int
    slot_id: int
    share_handbook: bool = False
    notes: str | None = Field(default=None, max_length=500)


class BookingOut(BaseModel):
    id: int
    expert_id: int
    expert_name: str
    expert_title: str
    slot_id: int
    slot_at: str
    share_handbook: bool
    handbook_snapshot: dict | None
    notes: str | None
    status: str
    created_at: str


def _build_handbook_snapshot(db: sqlite3.Connection) -> dict:
    """同意時に専門家へ転送する事実データのみを組み立てる。"""
    purchases = db.execute(
        "SELECT p.id, p.jan_code, p.purchased_at, p.price, p.quantity, p.purpose, p.memo, "
        "       p.family_member_name, p.follow_up_status, "
        "       prod.name AS product_name, prod.generic_name, prod.category "
        "FROM purchases p "
        "JOIN products prod ON p.jan_code = prod.jan_code "
        "ORDER BY p.purchased_at DESC "
        "LIMIT 50"
    ).fetchall()
    family = db.execute(
        "SELECT name, relationship, conditions, current_medications, allergies "
        "FROM family_members ORDER BY id"
    ).fetchall()
    return {
        "disclaimer": (
            "本データは利用者が登録した事実情報の転送です。"
            "診断・治療方針の決定・安全性判定を含むものではありません。"
        ),
        "purchases": [dict(r) for r in purchases],
        "family_members": [
            {
                "name": r["name"],
                "relationship": r["relationship"],
                "conditions": json.loads(r["conditions"] or "[]"),
                "current_medications": json.loads(r["current_medications"] or "[]"),
                "allergies": json.loads(r["allergies"] or "[]"),
            }
            for r in family
        ],
    }


def _booking_out(db: sqlite3.Connection, booking_id: int) -> BookingOut:
    row = db.execute(
        "SELECT b.*, e.name AS expert_name, e.title AS expert_title "
        "FROM bookings b JOIN experts e ON b.expert_id = e.id "
        "WHERE b.id = ?",
        [booking_id],
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="予約が見つかりません")
    snapshot = None
    if row["handbook_snapshot"]:
        snapshot = json.loads(row["handbook_snapshot"])
    return BookingOut(
        id=row["id"],
        expert_id=row["expert_id"],
        expert_name=row["expert_name"],
        expert_title=row["expert_title"],
        slot_id=row["slot_id"],
        slot_at=row["slot_at"],
        share_handbook=bool(row["share_handbook"]),
        handbook_snapshot=snapshot,
        notes=row["notes"],
        status=row["status"],
        created_at=row["created_at"],
    )


@router.get("/concierge/experts", response_model=list[ExpertOut])
def list_experts(db: sqlite3.Connection = Depends(get_db)) -> list[ExpertOut]:
    rows = db.execute(
        "SELECT * FROM experts WHERE is_active = 1 ORDER BY rating DESC, id"
    ).fetchall()
    return [
        ExpertOut(
            id=r["id"],
            name=r["name"],
            title=r["title"],
            area=r["area"],
            rating=r["rating"],
        )
        for r in rows
    ]


@router.get("/concierge/experts/{expert_id}/slots", response_model=list[SlotOut])
def list_slots(expert_id: int, db: sqlite3.Connection = Depends(get_db)) -> list[SlotOut]:
    expert = db.execute(
        "SELECT id FROM experts WHERE id = ? AND is_active = 1", [expert_id]
    ).fetchone()
    if expert is None:
        raise HTTPException(status_code=404, detail="専門家が見つかりません")
    rows = db.execute(
        "SELECT * FROM expert_slots WHERE expert_id = ? AND is_booked = 0 ORDER BY id",
        [expert_id],
    ).fetchall()
    return [
        SlotOut(
            id=r["id"],
            expert_id=r["expert_id"],
            slot_at=r["slot_at"],
            is_booked=bool(r["is_booked"]),
        )
        for r in rows
    ]


@router.get("/concierge/bookings", response_model=list[BookingOut])
def list_bookings(db: sqlite3.Connection = Depends(get_db)) -> list[BookingOut]:
    rows = db.execute("SELECT id FROM bookings ORDER BY id DESC").fetchall()
    return [_booking_out(db, r["id"]) for r in rows]


@router.post("/concierge/bookings", response_model=BookingOut)
def create_booking(
    body: BookingCreate, db: sqlite3.Connection = Depends(get_db)
) -> BookingOut:
    expert = db.execute(
        "SELECT * FROM experts WHERE id = ? AND is_active = 1", [body.expert_id]
    ).fetchone()
    if expert is None:
        raise HTTPException(status_code=404, detail="専門家が見つかりません")

    slot = db.execute(
        "SELECT * FROM expert_slots WHERE id = ? AND expert_id = ?",
        [body.slot_id, body.expert_id],
    ).fetchone()
    if slot is None:
        raise HTTPException(status_code=404, detail="予約枠が見つかりません")
    if slot["is_booked"]:
        raise HTTPException(status_code=409, detail="この枠は既に予約済みです")

    snapshot = None
    snapshot_json = None
    if body.share_handbook:
        snapshot = _build_handbook_snapshot(db)
        snapshot_json = json.dumps(snapshot, ensure_ascii=False)

    cur = db.execute(
        "INSERT INTO bookings "
        "(expert_id, slot_id, slot_at, share_handbook, handbook_snapshot, notes, status) "
        "VALUES (?, ?, ?, ?, ?, ?, 'confirmed')",
        [
            body.expert_id,
            body.slot_id,
            slot["slot_at"],
            int(body.share_handbook),
            snapshot_json,
            body.notes,
        ],
    )
    db.execute(
        "UPDATE expert_slots SET is_booked = 1 WHERE id = ?", [body.slot_id]
    )
    db.commit()
    return _booking_out(db, cur.lastrowid)
