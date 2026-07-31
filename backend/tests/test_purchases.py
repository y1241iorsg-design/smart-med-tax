def test_add_purchase_returns_saved_record(client):
    resp = client.post("/api/purchases", json={
        "jan_code": "4987117709559",
        "price": 980,
        "quantity": 1,
        "purchased_at": "2026-05-13",
        "store_name": "マツキヨ渋谷"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1
    assert data["product_name"] == "ロキソニンS 12錠"
    assert data["is_qualified"] == 1


def test_add_purchase_unknown_jan_returns_404(client):
    resp = client.post("/api/purchases", json={
        "jan_code": "0000000000000",
        "price": 500,
        "quantity": 1,
        "purchased_at": "2026-05-13"
    })
    assert resp.status_code == 404


def test_add_purchase_with_invalid_price_returns_422(client):
    resp = client.post("/api/purchases", json={
        "jan_code": "4987117709559",
        "price": 0,
        "quantity": 1,
        "purchased_at": "2026-05-13"
    })
    assert resp.status_code == 422


def test_add_purchase_negative_quantity_rejected(client):
    resp = client.post("/api/purchases", json={
        "jan_code": "4987117709559",
        "price": 980,
        "quantity": -1,
        "purchased_at": "2026-05-13"
    })
    assert resp.status_code == 422


def test_list_purchases_filters_by_year(client):
    # Add purchases in different years
    client.post("/api/purchases", json={
        "jan_code": "4987117709559",
        "price": 980,
        "quantity": 1,
        "purchased_at": "2026-03-10"
    })
    client.post("/api/purchases", json={
        "jan_code": "4987028112014",
        "price": 1280,
        "quantity": 1,
        "purchased_at": "2025-12-01"
    })
    resp = client.get("/api/purchases?year=2026")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["purchased_at"] == "2026-03-10"


def test_add_purchase_persists_purpose_and_memo(client):
    res = client.post(
        "/api/purchases",
        json={
            "jan_code": "4987117709559",
            "price": 980,
            "quantity": 1,
            "purchased_at": "2026-07-30",
            "purpose": "頭痛のため",
            "memo": "効果があった",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["purpose"] == "頭痛のため"
    assert body["memo"] == "効果があった"


def test_list_purchases_includes_purpose_and_memo(client):
    client.post(
        "/api/purchases",
        json={
            "jan_code": "4987117709559",
            "price": 980,
            "quantity": 1,
            "purchased_at": "2026-07-30",
            "purpose": "頭痛のため",
        },
    )
    res = client.get("/api/purchases?year=2026")
    assert res.json()[0]["purpose"] == "頭痛のため"
