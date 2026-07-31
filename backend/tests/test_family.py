import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_list_family_includes_self(client):
    res = client.get("/api/family")
    assert res.status_code == 200
    names = [m["name"] for m in res.json()]
    assert "自分" in names


def test_create_family_member(client):
    res = client.post("/api/family", json={
        "name": "母",
        "relationship": "母親",
        "conditions": ["高血圧"],
        "current_medications": [],
        "allergies": ["そば"],
    })
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "母"
    assert body["conditions"] == ["高血圧"]
    assert body["allergies"] == ["そば"]


def test_create_duplicate_name_returns_400(client):
    client.post("/api/family", json={"name": "母", "relationship": None, "conditions": [], "current_medications": [], "allergies": []})
    res = client.post("/api/family", json={"name": "母", "relationship": None, "conditions": [], "current_medications": [], "allergies": []})
    assert res.status_code == 400


def test_cannot_delete_self(client):
    members = client.get("/api/family").json()
    self_id = next(m["id"] for m in members if m["name"] == "自分")
    res = client.delete(f"/api/family/{self_id}")
    assert res.status_code == 400


def test_update_and_delete_member(client):
    created = client.post("/api/family", json={
        "name": "父", "relationship": "父親",
        "conditions": [], "current_medications": ["ロキソニン"], "allergies": [],
    }).json()
    res = client.patch(f"/api/family/{created['id']}", json={
        "name": "父", "relationship": "父親",
        "conditions": ["花粉症"], "current_medications": ["ロキソニン"], "allergies": [],
    })
    assert res.status_code == 200
    assert res.json()["conditions"] == ["花粉症"]
    res = client.delete(f"/api/family/{created['id']}")
    assert res.status_code == 200
