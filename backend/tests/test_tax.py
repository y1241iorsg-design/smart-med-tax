def _add(client, jan_code: str, price: int, date: str):
    client.post("/api/purchases", json={
        "jan_code": jan_code,
        "price": price,
        "quantity": 1,
        "purchased_at": date,
    })


def test_summary_returns_zero_with_no_purchases(client):
    resp = client.get("/api/tax/summary?year=2026")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_qualified"] == 0
    assert data["deductible_amount"] == 0
    assert data["is_qualified"] is False


def test_summary_below_threshold(client):
    _add(client, "4987117709559", 5000, "2026-01-10")  # A解熱鎮痛薬（対象）
    resp = client.get("/api/tax/summary?year=2026")
    data = resp.json()
    assert data["total_qualified"] == 5000
    assert data["deductible_amount"] == 0
    assert data["is_qualified"] is False


def test_summary_above_threshold(client):
    _add(client, "4987117709559", 8000, "2026-02-01")   # 対象
    _add(client, "4987028112014", 6000, "2026-03-01")   # 対象
    resp = client.get("/api/tax/summary?year=2026")
    data = resp.json()
    assert data["total_qualified"] == 14000
    assert data["deductible_amount"] == 2000           # 14000 - 12000
    assert data["is_qualified"] is True


def test_non_qualified_not_counted(client):
    _add(client, "4903301069171", 10000, "2026-01-01")  # ビタミンC（対象外）
    resp = client.get("/api/tax/summary?year=2026")
    assert resp.json()["total_qualified"] == 0


def test_export_csv_returns_file(client):
    _add(client, "4987117709559", 980, "2026-05-01")
    resp = client.get("/api/tax/export?year=2026&fmt=csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    content = resp.content.decode("utf-8-sig")
    assert "購入日" in content
    assert "A解熱鎮痛薬 12錠" in content


def test_export_xml_returns_file(client):
    _add(client, "4987117709559", 980, "2026-05-01")
    resp = client.get("/api/tax/export?year=2026&fmt=xml")
    assert resp.status_code == 200
    assert "xml" in resp.headers["content-type"]
    content = resp.content.decode("utf-8")
    assert "確定申告準備_セルフメディケーション税制" in content
    assert "A解熱鎮痛薬 12錠" in content


def test_export_invalid_format_returns_400(client):
    resp = client.get("/api/tax/export?year=2026&fmt=pdf")
    assert resp.status_code == 400


def test_summary_at_exact_threshold_not_qualified(client):
    _add(client, "4987117709559", 12000, "2026-01-01")  # exactly ¥12,000
    resp = client.get("/api/tax/summary?year=2026")
    data = resp.json()
    assert data["total_qualified"] == 12000
    assert data["is_qualified"] is False   # must EXCEED 12000, not just equal it
    assert data["deductible_amount"] == 0


def test_deduction_cap_applied_when_exceeds_88000(client):
    client.post("/api/purchases", json={
        "jan_code": "4987117709559",
        "price": 100001,
        "quantity": 1,
        "purchased_at": "2026-06-01",
    })
    data = client.get("/api/tax/summary?year=2026").json()
    assert data["raw_deductible_amount"] == 88001
    assert data["deductible_amount"] == 88000
    assert data["cap_applied"] is True
    assert data["deduction_cap"] == 88000
