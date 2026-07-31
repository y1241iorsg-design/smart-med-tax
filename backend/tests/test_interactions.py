def test_interaction_check_finds_ingredient_overlap(client):
    res = client.post(
        "/api/interactions/check",
        json={"jan_codes": ["4987117709559", "4987028112014"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert "disclaimer" in body
    assert len(body["precaution_notes"]) == 2
    assert "判定" not in body["disclaimer"] or "判定するものではありません" in body["disclaimer"]


def test_interaction_check_requires_at_least_two_products(client):
    res = client.post(
        "/api/interactions/check",
        json={"jan_codes": ["4987117709559"]},
    )
    assert res.status_code == 422


def test_interaction_check_unknown_jan_returns_404(client):
    res = client.post(
        "/api/interactions/check",
        json={"jan_codes": ["4987117709559", "0000000000000"]},
    )
    assert res.status_code == 404
