import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_severe_message_triggers_escalation(client):
    res = client.post("/api/chat", json={"history": [{"role": "user", "text": "息が苦しいです"}]})
    assert res.status_code == 200
    body = res.json()
    assert body["escalate"] is True
    assert body["ready_for_search"] is False
    assert "医療機関" in body["reply"]


def test_recognized_symptom_returns_ready_for_search(client):
    res = client.post("/api/chat", json={"history": [{"role": "user", "text": "頭が痛いです"}]})
    assert res.status_code == 200
    body = res.json()
    assert body["escalate"] is False
    assert body["ready_for_search"] is True
    assert "頭痛・発熱" in body["extracted_symptoms"]


def test_unrecognized_message_asks_clarifying_question(client):
    res = client.post("/api/chat", json={"history": [{"role": "user", "text": "こんにちは"}]})
    assert res.status_code == 200
    body = res.json()
    assert body["escalate"] is False
    assert body["ready_for_search"] is False
    assert body["extracted_symptoms"] == []


def test_empty_history_returns_422(client):
    res = client.post("/api/chat", json={"history": []})
    assert res.status_code == 422
