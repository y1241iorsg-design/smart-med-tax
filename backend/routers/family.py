import json
import sqlite3
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from condition_catalog import CONDITION_OPTIONS
from db import get_db

router = APIRouter()


class FamilyMemberIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    relationship: str | None = None
    conditions: list[str] = Field(default_factory=list)
    current_medications: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)


class FamilyMemberOut(BaseModel):
    id: int
    name: str
    relationship: str | None
    conditions: list[str]
    current_medications: list[str]
    allergies: list[str]


def _normalize_conditions(conditions: list[str]) -> list[str]:
    allowed = set(CONDITION_OPTIONS)
    return [c for c in conditions if c in allowed]


def _row_to_out(row: sqlite3.Row) -> FamilyMemberOut:
    return FamilyMemberOut(
        id=row["id"],
        name=row["name"],
        relationship=row["relationship"],
        conditions=json.loads(row["conditions"] or "[]"),
        current_medications=json.loads(row["current_medications"] or "[]"),
        allergies=json.loads(row["allergies"] or "[]"),
    )


@router.get("/family/condition-options", response_model=list[str])
def list_condition_options() -> list[str]:
    return CONDITION_OPTIONS


@router.get("/family", response_model=list[FamilyMemberOut])
def list_family(db: sqlite3.Connection = Depends(get_db)) -> list[FamilyMemberOut]:
    rows = db.execute("SELECT * FROM family_members ORDER BY id").fetchall()
    return [_row_to_out(r) for r in rows]


@router.post("/family", response_model=FamilyMemberOut)
def create_family(body: FamilyMemberIn, db: sqlite3.Connection = Depends(get_db)) -> FamilyMemberOut:
    exists = db.execute("SELECT id FROM family_members WHERE name = ?", [body.name]).fetchone()
    if exists:
        raise HTTPException(status_code=400, detail="同じ名前の家族が既に登録されています")
    conditions = _normalize_conditions(body.conditions)
    cur = db.execute(
        "INSERT INTO family_members (name, relationship, conditions, current_medications, allergies) "
        "VALUES (?, ?, ?, ?, ?)",
        [
            body.name,
            body.relationship,
            json.dumps(conditions, ensure_ascii=False),
            json.dumps(body.current_medications, ensure_ascii=False),
            json.dumps(body.allergies, ensure_ascii=False),
        ],
    )
    db.commit()
    row = db.execute("SELECT * FROM family_members WHERE id = ?", [cur.lastrowid]).fetchone()
    return _row_to_out(row)


@router.patch("/family/{member_id}", response_model=FamilyMemberOut)
def update_family(
    member_id: int, body: FamilyMemberIn, db: sqlite3.Connection = Depends(get_db)
) -> FamilyMemberOut:
    row = db.execute("SELECT * FROM family_members WHERE id = ?", [member_id]).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="家族が見つかりません")
    dup = db.execute(
        "SELECT id FROM family_members WHERE name = ? AND id != ?",
        [body.name, member_id],
    ).fetchone()
    if dup:
        raise HTTPException(status_code=400, detail="同じ名前の家族が既に登録されています")
    conditions = _normalize_conditions(body.conditions)
    db.execute(
        "UPDATE family_members SET name=?, relationship=?, conditions=?, "
        "current_medications=?, allergies=? WHERE id=?",
        [
            body.name,
            body.relationship,
            json.dumps(conditions, ensure_ascii=False),
            json.dumps(body.current_medications, ensure_ascii=False),
            json.dumps(body.allergies, ensure_ascii=False),
            member_id,
        ],
    )
    db.commit()
    row = db.execute("SELECT * FROM family_members WHERE id = ?", [member_id]).fetchone()
    return _row_to_out(row)


@router.delete("/family/{member_id}")
def delete_family(member_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute("SELECT * FROM family_members WHERE id = ?", [member_id]).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="家族が見つかりません")
    if row["name"] == "自分":
        raise HTTPException(status_code=400, detail="「自分」は削除できません")
    db.execute("DELETE FROM family_members WHERE id = ?", [member_id])
    db.commit()
    return {"ok": True}
