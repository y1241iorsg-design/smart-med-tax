import sqlite3
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import get_db

router = APIRouter()

DISCLAIMER = (
    "本情報は添付文書の記載を転送したものであり、飲み合わせの安全性を判定するものではありません。"
    "最終的な判断は薬剤師または登録販売者にご相談ください。"
)


class InteractionCheckRequest(BaseModel):
    jan_codes: list[str] = Field(min_length=2, max_length=10)


class IngredientOverlap(BaseModel):
    ingredient: str
    product_names: list[str]


class PrecautionNote(BaseModel):
    product_name: str
    generic_name: str
    precautions: str


class InteractionCheckResponse(BaseModel):
    overlaps: list[IngredientOverlap]
    precaution_notes: list[PrecautionNote]
    disclaimer: str


def _parse_ingredients(generic_name: str) -> list[str]:
    parts = generic_name.replace("・", " ").replace("/", " ").split()
    return [p.strip() for p in parts if len(p.strip()) >= 2]


def _find_overlaps(products: list[sqlite3.Row]) -> list[IngredientOverlap]:
    ingredient_map: dict[str, list[str]] = {}
    for row in products:
        for ing in _parse_ingredients(row["generic_name"]):
            ingredient_map.setdefault(ing, []).append(row["name"])
    return [
        IngredientOverlap(ingredient=ing, product_names=names)
        for ing, names in ingredient_map.items()
        if len(set(names)) > 1
    ]


@router.post("/interactions/check", response_model=InteractionCheckResponse)
def check_interactions(
    body: InteractionCheckRequest,
    db: sqlite3.Connection = Depends(get_db),
) -> InteractionCheckResponse:
    placeholders = ",".join("?" * len(body.jan_codes))
    rows = db.execute(
        f"SELECT jan_code, name, generic_name, precautions FROM products "
        f"WHERE jan_code IN ({placeholders})",
        body.jan_codes,
    ).fetchall()

    if len(rows) < 2:
        raise HTTPException(status_code=404, detail="比較対象の商品が2件以上必要です")

    return InteractionCheckResponse(
        overlaps=_find_overlaps(rows),
        precaution_notes=[
            PrecautionNote(
                product_name=r["name"],
                generic_name=r["generic_name"],
                precautions=r["precautions"],
            )
            for r in rows
        ],
        disclaimer=DISCLAIMER,
    )
