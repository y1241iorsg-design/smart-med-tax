from fastapi import APIRouter
from pydantic import BaseModel, Field
import re
from symptom_categories import (
    detect_severe_symptom,
    match_categories_from_text,
    ESCALATION_MESSAGE,
    NON_DIAGNOSIS_DISCLAIMER,
    CLARIFYING_QUESTION,
)

router = APIRouter()

MEDS_QUESTION = (
    "検索の参考に、普段から飲んでいる薬があれば教えてください"
    "（例: A解熱鎮痛薬）。なければ「なし」と入力してください。"
    "本サービスは診断を行うものではありません。"
)

NONE_MED_REPLIES = ("なし", "無い", "ない", "特になし", "ありません", "いいえ", "no")


class ChatTurn(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    history: list[ChatTurn] = Field(min_length=1)


class ChatTurnResponse(BaseModel):
    reply: str
    escalate: bool
    ready_for_search: bool
    extracted_symptoms: list[str]
    current_meds: list[str] = Field(default_factory=list)
    awaiting_meds: bool = False


def _unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _symptoms_from_history(history: list[ChatTurn]) -> list[str]:
    found: list[str] = []
    for turn in history:
        if turn.role == "user":
            found.extend(match_categories_from_text(turn.text))
    return _unique(found)


def _awaiting_meds_reply(history: list[ChatTurn]) -> bool:
    """直前のアシスタント発話が服用中薬の確認であるか。"""
    if len(history) < 2:
        return False
    for turn in reversed(history[:-1]):
        if turn.role == "assistant":
            return "普段から飲んでいる薬" in turn.text
        if turn.role == "user":
            break
    return False


def _parse_current_meds(text: str) -> list[str]:
    cleaned = text.strip()
    lower = cleaned.replace("　", " ")
    if lower.lower() in NONE_MED_REPLIES or any(lower == x for x in NONE_MED_REPLIES):
        return []
    if any(lower.startswith(x) for x in ("なし", "特になし", "ありません")):
        return []
    parts = re.split(r"[、,，/・\n]+|\s{2,}", cleaned)
    meds = [p.strip() for p in parts if p.strip() and p.strip() not in NONE_MED_REPLIES]
    return meds[:10]


@router.post("/chat", response_model=ChatTurnResponse)
def chat(body: ChatRequest) -> ChatTurnResponse:
    latest = body.history[-1].text

    if detect_severe_symptom(latest):
        return ChatTurnResponse(
            reply=ESCALATION_MESSAGE,
            escalate=True,
            ready_for_search=False,
            extracted_symptoms=[],
        )

    # 2通目: 服用中の薬への回答 → 検索へ
    if _awaiting_meds_reply(body.history):
        symptoms = _symptoms_from_history(body.history[:-1])
        if not symptoms:
            symptoms = match_categories_from_text(latest)
        meds = _parse_current_meds(latest)
        meds_note = (
            f"服用中として「{'・'.join(meds)}」を検索の参考にします。"
            if meds
            else "服用中の薬は特にないものとして検索します。"
        )
        reply = (
            f"{meds_note}\n"
            f"{'・'.join(symptoms) if symptoms else '症状'}に関連するOTC医薬品の情報を一覧で表示します。\n"
            f"{NON_DIAGNOSIS_DISCLAIMER}"
        )
        return ChatTurnResponse(
            reply=reply,
            escalate=False,
            ready_for_search=bool(symptoms),
            extracted_symptoms=symptoms,
            current_meds=meds,
            awaiting_meds=False,
        )

    matched = match_categories_from_text(latest)
    if matched:
        label = "・".join(matched)
        reply = (
            f"{label}に関連する情報が見つかりそうです。\n"
            f"{MEDS_QUESTION}"
        )
        return ChatTurnResponse(
            reply=reply,
            escalate=False,
            ready_for_search=False,
            extracted_symptoms=matched,
            current_meds=[],
            awaiting_meds=True,
        )

    return ChatTurnResponse(
        reply=CLARIFYING_QUESTION,
        escalate=False,
        ready_for_search=False,
        extracted_symptoms=[],
    )
