import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_search_returns_parallel_list_sorted_by_price(client):
    res = client.post("/api/products/search", json={"symptoms": ["頭痛・発熱"]})
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 2
    prices = [item["price"] for item in body]
    assert prices == sorted(prices)
    assert body[0]["vendor_count"] >= 1
    assert body[0]["vendor_min_price"] is not None


def test_search_result_contains_required_fields_for_screen_requirements(client):
    res = client.post("/api/products/search", json={"symptoms": ["頭痛・発熱"]})
    item = res.json()[0]
    for field in ("name", "efficacy", "dosage", "side_effects", "precautions", "pdf_url", "price", "is_qualified"):
        assert field in item


def test_search_does_not_include_ai_reasoning_field(client):
    """要件書「AIによる適合度スコアリングは行わない」の担保:
    レスポンスに推奨理由・スコア等のフィールドが存在しないことを確認する。"""
    res = client.post("/api/products/search", json={"symptoms": ["頭痛・発熱"]})
    item = res.json()[0]
    assert "score" not in item
    assert "reason" not in item
    assert "recommendation_reason" not in item


def test_search_with_empty_symptoms_returns_422(client):
    res = client.post("/api/products/search", json={"symptoms": []})
    assert res.status_code == 422


def test_search_flags_overlap_with_current_meds(client):
    res = client.post(
        "/api/products/search",
        json={"symptoms": ["頭痛・発熱"], "current_meds": ["ロキソプロフェンナトリウム水和物"]},
    )
    body = res.json()
    loxonin = next(item for item in body if item["name"].startswith("A解熱鎮痛薬"))
    assert loxonin["overlap_warning"] is True


def test_search_with_filter_narrows_results(client):
    res = client.post(
        "/api/products/search",
        json={"symptoms": ["肩こり・疲れ"], "filters": ["漢方・ナチュラル系"]},
    )
    body = res.json()
    assert all(
        "漢方" in item["name"]
        or "漢方" in item["generic_name"]
        or "逍遥" in item["generic_name"]
        or "生薬" in item["generic_name"]
        for item in body
    )


def test_get_vendors_for_known_product(client):
    res = client.get("/api/products/4987117709559/vendors")
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 2
    assert {"store_name", "price", "in_stock", "url", "is_lowest"} <= set(body[0].keys())
    assert body[0]["price"] <= body[-1]["price"]
    assert body[0]["is_lowest"] is True
    assert all(v["in_stock"] is True for v in body)
    assert "mock-store" not in body[0]["url"]


def test_price_compare_returns_min_max(client):
    res = client.get("/api/products/4987117709559/price-compare")
    assert res.status_code == 200
    body = res.json()
    assert body["min_price"] <= body["max_price"]
    assert len(body["vendors"]) >= 2
    assert "参考価格" in body["disclaimer"]
    assert "在庫" in body["disclaimer"]


def test_get_vendors_for_unknown_product_returns_404(client):
    res = client.get("/api/products/0000000000000/vendors")
    assert res.status_code == 404


def test_find_products_by_name(client):
    res = client.get("/api/products/find", params={"q": "A解熱鎮痛薬"})
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 1
    assert any("A解熱鎮痛薬" in p["name"] for p in body)
    assert "jan_code" in body[0]
    assert "price" in body[0]


def test_find_products_by_generic_name(client):
    res = client.get("/api/products/find", params={"q": "イブプロフェン"})
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 1
    assert any("イブプロフェン" in p["generic_name"] for p in body)


def test_find_products_empty_query_422(client):
    res = client.get("/api/products/find", params={"q": ""})
    assert res.status_code == 422


def test_find_products_no_match(client):
    res = client.get("/api/products/find", params={"q": "存在しない薬XYZ"})
    assert res.status_code == 200
    assert res.json() == []
