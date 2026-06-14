import os
from google import genai

_MOCK_RESPONSE = (
    "（AI模擬応答）ご症状に合わせた市販薬をご提案します。"
    "詳しくは薬剤師または登録販売者にご相談ください。"
)

SYSTEM_PROMPT = """あなたは日本のドラッグストアのAI薬剤アシスタントです。
以下のルールに従って回答してください：
- OTC（市販）医薬品の範囲で回答する
- 症状を聞かれたら適切な薬のカテゴリと具体的な製品名（例：ロキソニンS、ガスター10）を提案する
- 飲み合わせを聞かれたら、具体的な可否と理由を答える
- JANコードや薬品名から一般名・効能・用法・副作用を列挙する
- 回答は日本語で、簡潔に3〜5文程度にまとめる
- 処方箋医薬品・診断・治療は扱わない旨を必要に応じて明示する"""


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
