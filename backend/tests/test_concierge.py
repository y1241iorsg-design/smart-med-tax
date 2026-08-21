import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def test_list_experts(client):
    res = client.get("/api/concierge/experts")
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 3
    names = {e["name"] for e in body}
    assert "田中 誠" in names
    assert all("title" in e and "area" in e for e in body)


def test_list_slots_for_expert(client):
    experts = client.get("/api/concierge/experts").json()
    expert_id = experts[0]["id"]
    res = client.get(f"/api/concierge/experts/{expert_id}/slots")
    assert res.status_code == 200
    slots = res.json()
    assert len(slots) >= 1
    assert all(s["is_booked"] is False for s in slots)


def test_create_booking_persists_and_marks_slot(client):
    experts = client.get("/api/concierge/experts").json()
    expert = next(e for e in experts if e["name"] == "田中 誠")
    slots = client.get(f"/api/concierge/experts/{expert['id']}/slots").json()
    slot = slots[0]

    res = client.post(
        "/api/concierge/bookings",
        json={
            "expert_id": expert["id"],
            "slot_id": slot["id"],
            "share_handbook": False,
            "notes": "頭痛について相談したい",
        },
    )
    assert res.status_code == 200
    booking = res.json()
    assert booking["expert_name"] == "田中 誠"
    assert booking["slot_at"] == slot["slot_at"]
    assert booking["status"] == "confirmed"
    assert booking["share_handbook"] is False
    assert booking["notes"] == "頭痛について相談したい"

    # 枠が埋まる
    remaining = client.get(f"/api/concierge/experts/{expert['id']}/slots").json()
    assert all(s["id"] != slot["id"] for s in remaining)

    # 二重予約は 409
    dup = client.post(
        "/api/concierge/bookings",
        json={
            "expert_id": expert["id"],
            "slot_id": slot["id"],
            "share_handbook": False,
        },
    )
    assert dup.status_code == 409

    listed = client.get("/api/concierge/bookings").json()
    assert any(b["id"] == booking["id"] for b in listed)


def test_booking_with_handbook_share_includes_snapshot(client):
    # お薬手帳に1件追加
    products = client.get("/api/jan/4987117709559")
    assert products.status_code == 200
    client.post(
        "/api/purchases",
        json={
            "jan_code": "4987117709559",
            "price": 980,
            "quantity": 1,
            "purchased_at": "2026-07-01",
            "store_name": "テスト薬局",
        },
    )
    client.post(
        "/api/family",
        json={
            "name": "母",
            "relationship": "母親",
            "conditions": ["高血圧"],
            "current_medications": [],
            "allergies": [],
        },
    )

    experts = client.get("/api/concierge/experts").json()
    expert = next(e for e in experts if e["name"] == "山田 花子")
    slots = client.get(f"/api/concierge/experts/{expert['id']}/slots").json()

    res = client.post(
        "/api/concierge/bookings",
        json={
            "expert_id": expert["id"],
            "slot_id": slots[0]["id"],
            "share_handbook": True,
        },
    )
    assert res.status_code == 200
    booking = res.json()
    assert booking["share_handbook"] is True
    snap = booking["handbook_snapshot"]
    assert snap is not None
    assert "disclaimer" in snap
    assert any(p["jan_code"] == "4987117709559" for p in snap["purchases"])
    assert any(m["name"] == "母" for m in snap["family_members"])


def test_unknown_expert_slots_404(client):
    res = client.get("/api/concierge/experts/99999/slots")
    assert res.status_code == 404
