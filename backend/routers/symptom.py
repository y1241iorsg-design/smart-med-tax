import sqlite3
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from db import get_db
from gemini_client import ask_gemini

router = APIRouter()

_SYMPTOM_MOCK = (
    "（AI模擬応答）ご選択の症状に合わせたOTC医薬品をご提案します。\n"
    "・ロキソニンS（ロキソプロフェン）: 頭痛・発熱に速効性があり、眠くなりにくい成分です。\n"
    "・新ルルAゴールドDX: 鼻水・のどの痛みを含む総合感冒薬です。\n"
    "・命の母A: 更年期症状（ほてり・イライラ・肩こり）に対応した漢方成分配合です。\n"
    "用法・用量を必ずご確認ください。症状が続く場合は医療機関へご相談ください。"
)

_PERSONA_CONTEXT = (
    "対象ユーザー：40代、多忙な管理職女性、通院が難しいためドラッグストアでセルフケアを希望。"
    "更年期症状への関心が高く、眠くなりにくい・漢方など副作用に配慮した製品を好む。"
    "2026年現在のOTCトレンド（更年期漢方、高機能サプリ、美容OTC）も考慮して提案すること。"
)


def _build_prompt(symptoms: list[str], filters: list[str], past_purchases: list[str]) -> str:
    symptoms_str = "、".join(symptoms)
    filters_str = "、".join(filters) if filters else "なし"
    purchases_str = "、".join(past_purchases) if past_purchases else "なし"
    return (
        f"{_PERSONA_CONTEXT}\n\n"
        f"症状: {symptoms_str}\n"
        f"ご希望条件: {filters_str}\n"
        f"過去にご購入された薬（参考）: {purchases_str}\n\n"
        "上記の症状とご希望に合うOTC（市販）医薬品を3〜5品ご提案ください。\n"
        "形式: 「・薬品名（一般名）: 理由を1〜2文」\n"
        "処方箋医薬品・診断・治療は扱わない旨を末尾に1行で明示してください。"
    )


def _fetch_past_purchases(db: sqlite3.Connection) -> list[str]:
    one_year_ago = (date.today() - timedelta(days=365)).isoformat()
    rows = db.execute(
        "SELECT DISTINCT prod.name "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE p.purchased_at >= ? ORDER BY p.purchased_at DESC LIMIT 10",
        [one_year_ago],
    ).fetchall()
    return [r["name"] for r in rows]


class SymptomRequest(BaseModel):
    symptoms: list[str] = Field(min_length=1)
    filters: list[str] = Field(default_factory=list)


class SymptomResponse(BaseModel):
    reply: str
    past_purchases_used: list[str]


@router.post("/symptom/recommend", response_model=SymptomResponse)
def recommend(body: SymptomRequest, db: sqlite3.Connection = Depends(get_db)) -> SymptomResponse:
    past = _fetch_past_purchases(db)
    prompt = _build_prompt(body.symptoms, body.filters, past)
    reply = ask_gemini(prompt)
    return SymptomResponse(reply=reply, past_purchases_used=past)
