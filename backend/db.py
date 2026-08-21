import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "medtax.db"


def get_connection(path: Path | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path or DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, coldef: str) -> None:
    cols = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {coldef}")


def init_db(path: Path | None = None) -> None:
    target = path or DB_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    with get_connection(target) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                jan_code     TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                generic_name TEXT NOT NULL,
                efficacy     TEXT NOT NULL,
                category     TEXT NOT NULL,
                is_qualified INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS purchases (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                jan_code        TEXT NOT NULL REFERENCES products(jan_code),
                price           INTEGER NOT NULL,
                quantity        INTEGER NOT NULL DEFAULT 1,
                purchased_at    DATE NOT NULL,
                store_name      TEXT,
                remaining_doses INTEGER,
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS vendor_listings (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                jan_code   TEXT NOT NULL REFERENCES products(jan_code),
                store_name TEXT NOT NULL,
                price      INTEGER NOT NULL,
                in_stock   INTEGER NOT NULL DEFAULT 1,
                url        TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS family_members (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                name                 TEXT NOT NULL UNIQUE,
                relationship         TEXT,
                conditions           TEXT NOT NULL DEFAULT '[]',
                current_medications  TEXT NOT NULL DEFAULT '[]',
                allergies            TEXT NOT NULL DEFAULT '[]',
                created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS experts (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                title      TEXT NOT NULL,
                area       TEXT NOT NULL,
                rating     REAL NOT NULL DEFAULT 0,
                is_active  INTEGER NOT NULL DEFAULT 1
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS expert_slots (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                expert_id   INTEGER NOT NULL REFERENCES experts(id),
                slot_at     TEXT NOT NULL,
                is_booked   INTEGER NOT NULL DEFAULT 0,
                UNIQUE(expert_id, slot_at)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                expert_id            INTEGER NOT NULL REFERENCES experts(id),
                slot_id              INTEGER NOT NULL REFERENCES expert_slots(id),
                slot_at              TEXT NOT NULL,
                share_handbook       INTEGER NOT NULL DEFAULT 0,
                handbook_snapshot    TEXT,
                notes                TEXT,
                status               TEXT NOT NULL DEFAULT 'confirmed',
                created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS prescriptions (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                family_member_name   TEXT NOT NULL,
                rx_code              TEXT NOT NULL,
                started_at           DATE,
                memo                 TEXT,
                created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 4.2/4.3向けに追加した列(既存DBに対する後方互換マイグレーション)
        _ensure_column(conn, "products", "dosage", "dosage TEXT NOT NULL DEFAULT ''")
        _ensure_column(conn, "products", "side_effects", "side_effects TEXT NOT NULL DEFAULT ''")
        _ensure_column(conn, "products", "precautions", "precautions TEXT NOT NULL DEFAULT ''")
        _ensure_column(conn, "products", "pdf_url", "pdf_url TEXT NOT NULL DEFAULT ''")
        _ensure_column(conn, "products", "price", "price INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "purchases", "purpose", "purpose TEXT")
        _ensure_column(conn, "purchases", "memo", "memo TEXT")
        _ensure_column(conn, "purchases", "family_member_name", "family_member_name TEXT NOT NULL DEFAULT '自分'")
        _ensure_column(conn, "purchases", "follow_up_status", "follow_up_status TEXT NOT NULL DEFAULT '未入力'")
        _ensure_column(conn, "purchases", "follow_up_date", "follow_up_date DATE")

        _seed_products(conn)
        _seed_vendors(conn)
        _seed_family_self(conn)
        _seed_experts(conn)


def _seed_products(conn: sqlite3.Connection) -> None:
    from data.jan_mock import MOCK_PRODUCTS

    # products はマスタデータなので INSERT OR REPLACE で常に最新のシード内容に揃える。
    # purchases は REPLACE の対象にしないため、既存の購入履歴には影響しない。
    conn.executemany(
        "INSERT OR REPLACE INTO products "
        "(jan_code, name, generic_name, efficacy, category, is_qualified, "
        " dosage, side_effects, precautions, pdf_url, price) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (
                p["jan_code"],
                p["name"],
                p["generic_name"],
                p["efficacy"],
                p["category"],
                int(p["is_qualified"]),
                p["dosage"],
                p["side_effects"],
                p["precautions"],
                p["pdf_url"],
                p["price"],
            )
            for p in MOCK_PRODUCTS
        ],
    )


def _seed_vendors(conn: sqlite3.Connection) -> None:
    from data.vendor_mock import generate_vendor_listings
    from data.jan_mock import MOCK_PRODUCTS

    # 価格比較用シード。在庫は連動しない（常に in_stock=1）。
    # 起動のたびに全削除→再生成して参考価格を揃える。
    conn.execute("DELETE FROM vendor_listings")
    listings = generate_vendor_listings(MOCK_PRODUCTS)
    conn.executemany(
        "INSERT INTO vendor_listings (jan_code, store_name, price, in_stock, url) "
        "VALUES (?, ?, ?, ?, ?)",
        [
            (v["jan_code"], v["store_name"], v["price"], int(v["in_stock"]), v["url"])
            for v in listings
        ],
    )
    # 商品の表示価格をチャネル最安の参考価格に揃える（検索の価格順と連動）
    for p in MOCK_PRODUCTS:
        row = conn.execute(
            "SELECT MIN(price) AS min_price FROM vendor_listings WHERE jan_code = ?",
            [p["jan_code"]],
        ).fetchone()
        if row and row["min_price"] is not None:
            conn.execute(
                "UPDATE products SET price = ? WHERE jan_code = ?",
                [row["min_price"], p["jan_code"]],
            )


def _seed_family_self(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        "SELECT id FROM family_members WHERE name = ?", ["自分"]
    ).fetchone()
    if row is None:
        conn.execute(
            "INSERT INTO family_members (name, relationship, conditions, current_medications, allergies) "
            "VALUES ('自分', '本人', '[]', '[]', '[]')"
        )


def _seed_experts(conn: sqlite3.Connection) -> None:
    """専門家・空き枠のデモシード。既存予約がある場合は上書きしない。"""
    count = conn.execute("SELECT COUNT(*) AS c FROM experts").fetchone()["c"]
    if count > 0:
        return

    experts = [
        ("田中 誠", "薬剤師", "渋谷区", 4.8),
        ("山田 花子", "登録販売者", "新宿区", 4.6),
        ("佐藤 健", "薬剤師", "港区", 4.9),
    ]
    for name, title, area, rating in experts:
        conn.execute(
            "INSERT INTO experts (name, title, area, rating, is_active) VALUES (?, ?, ?, ?, 1)",
            [name, title, area, rating],
        )

    # 相対的な空き枠（今日〜明日の固定時刻ラベル）
    slots_by_name = {
        "田中 誠": ["今日 14:00", "今日 16:30", "明日 10:00"],
        "山田 花子": ["今日 15:00", "明日 11:00", "明日 13:00"],
        "佐藤 健": ["今日 17:00", "明日 09:30", "明日 14:00"],
    }
    for name, slots in slots_by_name.items():
        expert = conn.execute("SELECT id FROM experts WHERE name = ?", [name]).fetchone()
        if expert is None:
            continue
        for slot_at in slots:
            conn.execute(
                "INSERT INTO expert_slots (expert_id, slot_at, is_booked) VALUES (?, ?, 0)",
                [expert["id"], slot_at],
            )


def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
