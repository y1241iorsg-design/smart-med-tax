from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()

_PHARMACIST_KEYWORDS = ["持病", "処方", "飲み合わせ", "相互作用", "妊娠", "授乳", "アレルギー", "症状が続く"]
_SELLER_KEYWORDS = ["副作用", "成分", "効かない", "長期", "子供", "高齢者"]

_RESPONDERS = {
    "ai":                ("AIアシスタント", "自動応答"),
    "registered_seller": ("山田花子",       "登録販売者"),
    "pharmacist":        ("田中誠",          "薬剤師"),
}

_MOCK_REPLIES = {
    "ai": (
        "ご症状に合わせたOTC医薬品をご提案します。"
        "頭痛・発熱には「ロキソニンS」や「バファリンA」、"
        "胃痛・胸やけには「ガスター10」が一般的です。"
        "用法・用量を必ずご確認ください。"
    ),
    "registered_seller": (
        "（登録販売者：山田花子）副作用や成分についてご不安な場合は、"
        "お気軽にご相談ください。症状や他のお薬との組み合わせを確認した上で"
        "最適な製品をご案内します。"
    ),
    "pharmacist": (
        "（薬剤師：田中誠）持病・処方薬との飲み合わせや妊娠中の服用については、"
        "必ず薬剤師にご相談ください。安全のため、現在お飲みの薬をすべてお知らせ"
        "いただけますと適切にご案内できます。"
    ),
}


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class ChatResponse(BaseModel):
    reply: str
    escalation_level: str
    responder_name: str
    responder_title: str


def _escalation_level(message: str) -> str:
    for kw in _PHARMACIST_KEYWORDS:
        if kw in message:
            return "pharmacist"
    for kw in _SELLER_KEYWORDS:
        if kw in message:
            return "registered_seller"
    return "ai"


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest) -> ChatResponse:
    level = _escalation_level(body.message)
    name, title = _RESPONDERS[level]
    reply = _MOCK_REPLIES[level]
    return ChatResponse(
        reply=reply,
        escalation_level=level,
        responder_name=name,
        responder_title=title,
    )
