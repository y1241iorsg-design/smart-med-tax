import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient
from main import app
from db import get_db, init_db, get_connection


@pytest.fixture
def test_db_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.db"
    init_db(path)
    return path


@pytest.fixture
def client(test_db_path: Path) -> TestClient:
    def override_get_db():
        conn = get_connection(test_db_path)
        try:
            yield conn
        finally:
            conn.close()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_recommend_returns_reply(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    resp = client.post("/api/symptom/recommend", json={
        "symptoms": ["頭痛・発熱"],
        "filters": []
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert isinstance(data["reply"], str)
    assert len(data["reply"]) > 0


def test_recommend_includes_past_purchases_field(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    resp = client.post("/api/symptom/recommend", json={
        "symptoms": ["胃・腸の不調"],
        "filters": ["過去購入品を優先"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "past_purchases_used" in data
    assert isinstance(data["past_purchases_used"], list)


def test_recommend_uses_purchase_history(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    client.post("/api/purchases", json={
        "jan_code": "4987117709559",
        "price": 980,
        "quantity": 1,
        "purchased_at": "2026-05-01",
    })
    resp = client.post("/api/symptom/recommend", json={
        "symptoms": ["頭痛・発熱"],
        "filters": ["過去購入品を優先"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "ロキソニンS 12錠" in data["past_purchases_used"]


def test_recommend_empty_symptoms_returns_422(client):
    resp = client.post("/api/symptom/recommend", json={
        "symptoms": [],
        "filters": []
    })
    assert resp.status_code == 422


def test_recommend_missing_symptoms_returns_422(client):
    resp = client.post("/api/symptom/recommend", json={"filters": []})
    assert resp.status_code == 422


def test_recommend_with_filters(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    resp = client.post("/api/symptom/recommend", json={
        "symptoms": ["更年期症状（ほてり・イライラ・動悸）"],
        "filters": ["更年期・ホルモンケア向け", "漢方・ナチュラル系"]
    })
    assert resp.status_code == 200
    assert len(resp.json()["reply"]) > 0
