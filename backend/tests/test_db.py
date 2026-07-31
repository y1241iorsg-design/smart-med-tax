import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from db import get_connection, init_db


def test_products_table_has_new_columns(tmp_path):
    path = tmp_path / "test.db"
    init_db(path)
    conn = get_connection(path)
    cols = {row["name"] for row in conn.execute("PRAGMA table_info(products)")}
    assert {"dosage", "side_effects", "precautions", "pdf_url", "price"} <= cols
    conn.close()


def test_purchases_table_has_purpose_and_memo(tmp_path):
    path = tmp_path / "test.db"
    init_db(path)
    conn = get_connection(path)
    cols = {row["name"] for row in conn.execute("PRAGMA table_info(purchases)")}
    assert {"purpose", "memo"} <= cols
    conn.close()


def test_vendor_listings_table_exists_and_is_seeded(tmp_path):
    path = tmp_path / "test.db"
    init_db(path)
    conn = get_connection(path)
    rows = conn.execute("SELECT * FROM vendor_listings LIMIT 1").fetchall()
    assert len(rows) > 0
    conn.close()


def test_reinit_does_not_duplicate_or_break_existing_purchases(tmp_path):
    """スキーマ移行が既存の purchases 行を壊さないことを確認する(FK制約含む)。"""
    path = tmp_path / "test.db"
    init_db(path)
    conn = get_connection(path)
    conn.execute(
        "INSERT INTO purchases (jan_code, price, quantity, purchased_at) "
        "VALUES ('4987117709559', 980, 1, '2026-01-01')"
    )
    conn.commit()
    conn.close()

    # 再度 init_db を呼んでも既存の purchases 行が残っていること
    init_db(path)
    conn = get_connection(path)
    rows = conn.execute("SELECT * FROM purchases").fetchall()
    assert len(rows) == 1
    conn.close()


def test_family_members_table_exists_and_seeds_self(tmp_path):
    path = tmp_path / "test.db"
    init_db(path)
    conn = get_connection(path)
    rows = conn.execute("SELECT name FROM family_members").fetchall()
    assert any(r["name"] == "自分" for r in rows)
    conn.close()


def test_purchases_table_has_followup_and_family_columns(tmp_path):
    path = tmp_path / "test.db"
    init_db(path)
    conn = get_connection(path)
    cols = {row["name"] for row in conn.execute("PRAGMA table_info(purchases)")}
    assert {"family_member_name", "follow_up_status", "follow_up_date"} <= cols
    conn.close()
