import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "medtax.db"


def get_connection(path: Path | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path or DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


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
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                jan_code     TEXT NOT NULL REFERENCES products(jan_code),
                price        INTEGER NOT NULL,
                quantity     INTEGER NOT NULL DEFAULT 1,
                purchased_at DATE NOT NULL,
                store_name   TEXT,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        _seed_products(conn)


def _seed_products(conn: sqlite3.Connection) -> None:
    from data.jan_mock import MOCK_PRODUCTS

    conn.executemany(
        "INSERT OR IGNORE INTO products "
        "(jan_code, name, generic_name, efficacy, category, is_qualified) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        [
            (
                p["jan_code"],
                p["name"],
                p["generic_name"],
                p["efficacy"],
                p["category"],
                int(p["is_qualified"]),
            )
            for p in MOCK_PRODUCTS
        ],
    )


def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
