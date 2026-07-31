import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from gemini_client import SYSTEM_PROMPT

_FORBIDDEN_PHRASES = ["最適な薬を選ぶ", "具体的な可否を答える", "必ず治ります", "治ります"]


def test_system_prompt_avoids_forbidden_diagnostic_language():
    for phrase in _FORBIDDEN_PHRASES:
        assert phrase not in SYSTEM_PROMPT


def test_system_prompt_requires_non_diagnosis_disclaimer():
    assert "診断ではな" in SYSTEM_PROMPT or "診断を行うものではありません" in SYSTEM_PROMPT
