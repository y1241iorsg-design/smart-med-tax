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


def test_recognized_symptom_asks_current_meds_first(client):
    res = client.post("/api/chat", json={"history": [{"role": "user", "text": "頭が痛いです"}]})
    assert res.status_code == 200
    body = res.json()
    assert body["escalate"] is False
    assert body["ready_for_search"] is False
    assert body["awaiting_meds"] is True
    assert "頭痛・発熱" in body["extracted_symptoms"]
    assert "普段から飲んでいる薬" in body["reply"]


def test_meds_reply_enables_search(client):
    history = [
        {"role": "user", "text": "頭が痛いです"},
        {
            "role": "assistant",
            "text": "頭痛・発熱に関連する情報が見つかりそうです。\n普段から飲んでいる薬があれば教えてください",
        },
        {"role": "user", "text": "A解熱鎮痛薬"},
    ]
    res = client.post("/api/chat", json={"history": history})
    assert res.status_code == 200
    body = res.json()
    assert body["ready_for_search"] is True
    assert body["awaiting_meds"] is False
    assert "A解熱鎮痛薬" in body["current_meds"]
    assert "頭痛・発熱" in body["extracted_symptoms"]


def test_none_meds_reply(client):
    history = [
        {"role": "user", "text": "頭が痛いです"},
        {
            "role": "assistant",
            "text": "普段から飲んでいる薬があれば教えてください",
        },
        {"role": "user", "text": "なし"},
    ]
    res = client.post("/api/chat", json={"history": history})
    assert res.status_code == 200
    body = res.json()
    assert body["ready_for_search"] is True
    assert body["current_meds"] == []


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
