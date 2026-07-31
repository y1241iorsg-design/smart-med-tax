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
    loxonin = next(item for item in body if item["name"].startswith("ロキソニン"))
    assert loxonin["overlap_warning"] is True


def test_search_with_filter_narrows_results(client):
    res = client.post(
        "/api/products/search",
        json={"symptoms": ["肩こり・疲れ"], "filters": ["漢方・ナチュラル系"]},
    )
    body = res.json()
    assert all("漢方" in item["generic_name"] or "逍遥" in item["name"] for item in body)


def test_get_vendors_for_known_product(client):
    res = client.get("/api/products/4987117709559/vendors")
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 2
    assert {"store_name", "price", "in_stock", "url"} <= set(body[0].keys())


def test_get_vendors_for_unknown_product_returns_404(client):
    res = client.get("/api/products/0000000000000/vendors")
    assert res.status_code == 404
