import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from gemini_client import ask_gemini


def test_ask_gemini_returns_string_in_mock_mode(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    result = ask_gemini("頭痛に効く薬を教えて")
    assert isinstance(result, str)
    assert len(result) > 0
