from fastapi import APIRouter
from pydantic import BaseModel, Field
from symptom_categories import (
    detect_severe_symptom,
    match_categories_from_text,
    ESCALATION_MESSAGE,
    NON_DIAGNOSIS_DISCLAIMER,
    CLARIFYING_QUESTION,
)

router = APIRouter()


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

    matched = match_categories_from_text(latest)
    if matched:
        label = "・".join(matched)
        reply = f"{label}に関連するOTC医薬品の情報を一覧で表示します。\n{NON_DIAGNOSIS_DISCLAIMER}"
        return ChatTurnResponse(
            reply=reply,
            escalate=False,
            ready_for_search=True,
            extracted_symptoms=matched,
        )

    return ChatTurnResponse(
        reply=CLARIFYING_QUESTION,
        escalate=False,
        ready_for_search=False,
        extracted_symptoms=[],
    )
