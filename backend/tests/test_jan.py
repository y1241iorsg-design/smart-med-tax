def test_lookup_known_jan_returns_product(client):
    resp = client.get("/api/jan/4987117709559")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "A解熱鎮痛薬 12錠"
    assert data["is_qualified"] == 1


def test_lookup_non_qualified_product(client):
    resp = client.get("/api/jan/4903301069171")
    assert resp.status_code == 200
    assert resp.json()["is_qualified"] == 0


def test_lookup_unknown_jan_returns_404(client):
    resp = client.get("/api/jan/0000000000000")
    assert resp.status_code == 404
    assert "登録されていません" in resp.json()["detail"]
