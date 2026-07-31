import os
from google import genai

_MOCK_RESPONSE = (
    "（AI模擬応答）ご症状に合わせた市販薬をご提案します。"
    "詳しくは薬剤師または登録販売者にご相談ください。"
)

SYSTEM_PROMPT = """あなたは日本のドラッグストアのセルフメディケーション支援アプリの補助アシスタントです。
以下のルールを厳守してください：
- OTC（市販）医薬品の一般的な情報提供のみを行う。診断や治療方針の決定は行わない
- 症状を聞かれても「診断」はせず、対応できる可能性のあるOTC医薬品のカテゴリを案内するに留める
- 飲み合わせについて具体的な可否を断定せず、一般的な注意点を伝えた上で薬剤師・登録販売者への相談を促す
- 「必ず治る」「確実に効く」等の断定的な表現は使わない
- 症状が重い、または続く場合は医療機関の受診を促す
- 回答は日本語で簡潔に3〜5文程度にまとめる
- 末尾に「本情報は診断ではなく、最終判断は薬剤師・登録販売者にご相談ください」と明示する"""


def ask_gemini(user_message: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "your_api_key_here":
        return _MOCK_RESPONSE

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents=f"{SYSTEM_PROMPT}\n\nユーザー: {user_message}",
        )
        return response.text or _MOCK_RESPONSE
    except Exception:
        return _MOCK_RESPONSE
