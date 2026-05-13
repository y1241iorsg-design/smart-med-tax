# Smart Med-Tax MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JANコードスキャンで購入記録を蓄積し、セルフメディケーション税制（年間¥12,000超）を自動判定してCSV/XMLで申告データを出力するMVP Webアプリを構築する。

**Architecture:** Next.js 14 (App Router, port 3000) がフロントエンドを担い、FastAPI (port 8000) がREST APIとSQLite永続化を担う2プロセス構成。JANコード商品データはモックPythonファイルで提供し、将来は外部APIに差し替え可能なインターフェースを持つ。

**Tech Stack:** Next.js 14 / TypeScript / Tailwind CSS (frontend), FastAPI / uvicorn / SQLite / uv (backend), pytest + httpx (backend tests), Playwright (E2E tests)

---

## File Map

```
smart-med-tax/
├── .env                              # GEMINI_API_KEY（テンプレート）
├── frontend/
│   ├── package.json
│   ├── playwright.config.ts          # E2Eテスト設定
│   ├── app/
│   │   ├── layout.tsx                # ルートレイアウト + NavBar
│   │   ├── globals.css
│   │   ├── page.tsx                  # ホーム / ダッシュボード
│   │   ├── scan/page.tsx             # JANスキャン + 商品追加
│   │   ├── history/page.tsx          # 購入履歴
│   │   └── tax/page.tsx              # 税制レポート + エクスポート
│   ├── components/
│   │   └── NavBar.tsx                # 下部ナビゲーションバー
│   ├── lib/
│   │   └── api.ts                    # FastAPI呼び出し関数群
│   └── e2e/
│       └── scan-flow.spec.ts         # E2Eテスト
└── backend/
    ├── pyproject.toml
    ├── main.py                       # FastAPIアプリ本体、CORS、ルーター登録
    ├── db.py                         # SQLite接続、スキーマ初期化、get_db依存性
    ├── data/
    │   ├── __init__.py
    │   └── jan_mock.py               # モックJAN商品リスト
    ├── routers/
    │   ├── __init__.py
    │   ├── jan.py                    # GET /api/jan/{code}
    │   ├── purchases.py              # POST/GET /api/purchases
    │   └── tax.py                    # GET /api/tax/summary, /api/tax/export
    └── tests/
        ├── conftest.py               # テスト用DBフィクスチャ
        ├── test_jan.py
        ├── test_purchases.py
        └── test_tax.py
```

---

## Task 1: プロジェクトルート + バックエンド雛形

**Files:**
- Create: `smart-med-tax/.env`
- Create: `backend/pyproject.toml`
- Create: `backend/main.py`
- Create: `backend/routers/__init__.py`
- Create: `backend/data/__init__.py`

- [ ] **Step 1: .env テンプレートを作成**

```bash
cat > /Users/ao/Desktop/smart-med-tax/.env << 'EOF'
GEMINI_API_KEY=your_api_key_here
EOF
```

- [ ] **Step 2: backend/pyproject.toml を作成**

`backend/pyproject.toml`:
```toml
[project]
name = "smart-med-tax-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "python-dotenv>=1.0.0",
    "google-genai>=1.47.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "httpx>=0.27.0",
    "pytest-playwright>=0.7.0",
    "playwright>=1.40.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 3: uv で仮想環境を初期化**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv sync --dev
```

Expected: `.venv/` が作成され、依存パッケージがインストールされる。

- [ ] **Step 4: backend/main.py を作成**

`backend/main.py`:
```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from db import init_db
from routers import jan, purchases, tax

load_dotenv(dotenv_path="../.env")

app = FastAPI(title="Smart Med-Tax API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jan.router, prefix="/api")
app.include_router(purchases.router, prefix="/api")
app.include_router(tax.router, prefix="/api")


@app.on_event("startup")
def startup() -> None:
    init_db()
```

- [ ] **Step 5: パッケージ init ファイルを作成**

```bash
touch /Users/ao/Desktop/smart-med-tax/backend/routers/__init__.py
touch /Users/ao/Desktop/smart-med-tax/backend/data/__init__.py
```

- [ ] **Step 6: 起動確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run uvicorn main:app --port 8000
```

Expected: `Uvicorn running on http://0.0.0.0:8000` が表示される（DB未初期化のエラーが出ても後続タスクで解決される）。Ctrl+C で停止。

- [ ] **Step 7: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add backend/ .env
git commit -m "feat: scaffold backend with FastAPI and uv"
```

---

## Task 2: SQLite スキーマ + モックJANデータ

**Files:**
- Create: `backend/db.py`
- Create: `backend/data/jan_mock.py`

- [ ] **Step 1: backend/data/jan_mock.py を作成**

`backend/data/jan_mock.py`:
```python
from typing import TypedDict


class ProductData(TypedDict):
    jan_code: str
    name: str
    generic_name: str
    efficacy: str
    category: str
    is_qualified: bool


MOCK_PRODUCTS: list[ProductData] = [
    {
        "jan_code": "4987117709559",
        "name": "ロキソニンS 12錠",
        "generic_name": "ロキソプロフェンナトリウム水和物",
        "efficacy": "頭痛・歯痛・生理痛・発熱の緩和",
        "category": "解熱鎮痛薬",
        "is_qualified": True,
    },
    {
        "jan_code": "4987028112014",
        "name": "ガスター10 12錠",
        "generic_name": "ファモチジン",
        "efficacy": "胃痛・もたれ・胸やけ・むかつきの緩和",
        "category": "胃腸薬",
        "is_qualified": True,
    },
    {
        "jan_code": "4901301254115",
        "name": "バファリンA 20錠",
        "generic_name": "アスピリン・ダイアルミネート",
        "efficacy": "頭痛・発熱・月経痛の緩和",
        "category": "解熱鎮痛薬",
        "is_qualified": True,
    },
    {
        "jan_code": "4987123704748",
        "name": "ストッパ下痢止めEX 12錠",
        "generic_name": "ロペラミド塩酸塩",
        "efficacy": "急性下痢・軟便の緩和",
        "category": "止瀉薬",
        "is_qualified": True,
    },
    {
        "jan_code": "4901427016041",
        "name": "新ルルAゴールドDX 30錠",
        "generic_name": "総合感冒薬",
        "efficacy": "鼻水・鼻づまり・のどの痛み・発熱の緩和",
        "category": "かぜ薬",
        "is_qualified": True,
    },
    {
        "jan_code": "4903301069171",
        "name": "ビタミンC 300錠",
        "generic_name": "アスコルビン酸",
        "efficacy": "ビタミンCの補給",
        "category": "ビタミン剤",
        "is_qualified": False,
    },
]
```

- [ ] **Step 2: backend/db.py を作成**

`backend/db.py`:
```python
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
```

- [ ] **Step 3: DB初期化の動作確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run python -c "from db import init_db; init_db(); print('DB OK')"
```

Expected: `DB OK` が表示され、`backend/data/medtax.db` が作成される。

- [ ] **Step 4: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
echo "backend/data/medtax.db" >> .gitignore
git add backend/db.py backend/data/jan_mock.py backend/data/__init__.py .gitignore
git commit -m "feat: add SQLite schema and mock JAN product data"
```

---

## Task 3: JAN検索ルーター + テスト

**Files:**
- Create: `backend/routers/jan.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_jan.py`

- [ ] **Step 1: テスト用 conftest.py を作成**

`backend/tests/conftest.py`:
```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient
from main import app
from db import get_db, init_db, get_connection


@pytest.fixture
def test_db_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.db"
    init_db(path)
    return path


@pytest.fixture
def client(test_db_path: Path) -> TestClient:
    def override_get_db():
        conn = get_connection(test_db_path)
        try:
            yield conn
        finally:
            conn.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 2: 失敗するテストを書く**

`backend/tests/test_jan.py`:
```python
def test_lookup_known_jan_returns_product(client):
    resp = client.get("/api/jan/4987117709559")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "ロキソニンS 12錠"
    assert data["is_qualified"] is True


def test_lookup_non_qualified_product(client):
    resp = client.get("/api/jan/4903301069171")
    assert resp.status_code == 200
    assert resp.json()["is_qualified"] is False


def test_lookup_unknown_jan_returns_404(client):
    resp = client.get("/api/jan/0000000000000")
    assert resp.status_code == 404
    assert "登録されていません" in resp.json()["detail"]
```

- [ ] **Step 3: テストが失敗することを確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_jan.py -v
```

Expected: `ImportError` or `404` — ルーターがまだない。

- [ ] **Step 4: backend/routers/jan.py を実装**

`backend/routers/jan.py`:
```python
import sqlite3
from fastapi import APIRouter, Depends, HTTPException
from db import get_db

router = APIRouter()


@router.get("/jan/{code}")
def lookup_jan(code: str, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT * FROM products WHERE jan_code = ?", [code]
    ).fetchone()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail="この商品は登録されていません。手動で追加できます。",
        )
    return dict(row)
```

- [ ] **Step 5: テストがすべてパスすることを確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_jan.py -v
```

Expected:
```
PASSED tests/test_jan.py::test_lookup_known_jan_returns_product
PASSED tests/test_jan.py::test_lookup_non_qualified_product
PASSED tests/test_jan.py::test_lookup_unknown_jan_returns_404
```

- [ ] **Step 6: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add backend/routers/jan.py backend/tests/
git commit -m "feat: add JAN lookup endpoint with tests"
```

---

## Task 4: 購入記録ルーター + テスト

**Files:**
- Create: `backend/routers/purchases.py`
- Create: `backend/tests/test_purchases.py`

- [ ] **Step 1: 失敗するテストを書く**

`backend/tests/test_purchases.py`:
```python
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
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_purchases.py -v
```

Expected: `ImportError` or connection error — ルーターがまだない。

- [ ] **Step 3: backend/routers/purchases.py を実装**

`backend/routers/purchases.py`:
```python
import sqlite3
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import get_db

router = APIRouter()


class PurchaseCreate(BaseModel):
    jan_code: str
    price: int
    quantity: int = 1
    purchased_at: date
    store_name: str | None = None


@router.post("/purchases")
def add_purchase(
    body: PurchaseCreate, db: sqlite3.Connection = Depends(get_db)
):
    product = db.execute(
        "SELECT * FROM products WHERE jan_code = ?", [body.jan_code]
    ).fetchone()
    if product is None:
        raise HTTPException(status_code=404, detail="商品が見つかりません")

    cursor = db.execute(
        "INSERT INTO purchases (jan_code, price, quantity, purchased_at, store_name) "
        "VALUES (?, ?, ?, ?, ?)",
        [body.jan_code, body.price, body.quantity,
         body.purchased_at.isoformat(), body.store_name],
    )
    db.commit()

    row = db.execute(
        "SELECT p.*, prod.name AS product_name, prod.is_qualified "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE p.id = ?",
        [cursor.lastrowid],
    ).fetchone()
    return dict(row)


@router.get("/purchases")
def list_purchases(year: int, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT p.*, prod.name AS product_name, prod.is_qualified "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE strftime('%Y', p.purchased_at) = ? "
        "ORDER BY p.purchased_at DESC",
        [str(year)],
    ).fetchall()
    return [dict(r) for r in rows]
```

- [ ] **Step 4: テストがすべてパスすることを確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_purchases.py -v
```

Expected:
```
PASSED tests/test_purchases.py::test_add_purchase_returns_saved_record
PASSED tests/test_purchases.py::test_add_purchase_unknown_jan_returns_404
PASSED tests/test_purchases.py::test_list_purchases_filters_by_year
```

- [ ] **Step 5: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add backend/routers/purchases.py backend/tests/test_purchases.py
git commit -m "feat: add purchases CRUD endpoint with tests"
```

---

## Task 5: 税制計算ルーター + テスト

**Files:**
- Create: `backend/routers/tax.py`
- Create: `backend/tests/test_tax.py`

- [ ] **Step 1: 失敗するテストを書く**

`backend/tests/test_tax.py`:
```python
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
    _add(client, "4987117709559", 5000, "2026-01-10")  # ロキソニン（対象）
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
    resp = client.get("/api/tax/export?year=2026&format=csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    content = resp.content.decode("utf-8-sig")
    assert "購入日" in content
    assert "ロキソニンS 12錠" in content


def test_export_xml_returns_file(client):
    _add(client, "4987117709559", 980, "2026-05-01")
    resp = client.get("/api/tax/export?year=2026&format=xml")
    assert resp.status_code == 200
    assert "xml" in resp.headers["content-type"]
    content = resp.content.decode("utf-8")
    assert "医療費控除の明細書" in content
    assert "ロキソニンS 12錠" in content


def test_export_invalid_format_returns_400(client):
    resp = client.get("/api/tax/export?year=2026&format=pdf")
    assert resp.status_code == 400
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_tax.py -v
```

Expected: `ImportError` — ルーターがない。

- [ ] **Step 3: backend/routers/tax.py を実装**

`backend/routers/tax.py`:
```python
import csv
import io
import sqlite3
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from db import get_db

router = APIRouter()

THRESHOLD = 12_000


@router.get("/tax/summary")
def tax_summary(year: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT COALESCE(SUM(p.price * p.quantity), 0) AS total "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE prod.is_qualified = 1 AND strftime('%Y', p.purchased_at) = ?",
        [str(year)],
    ).fetchone()
    total: int = row["total"]
    deductible = max(0, total - THRESHOLD)
    return {
        "year": year,
        "total_qualified": total,
        "deductible_amount": deductible,
        "threshold": THRESHOLD,
        "is_qualified": total >= THRESHOLD,
    }


@router.get("/tax/export")
def tax_export(
    year: int, format: str, db: sqlite3.Connection = Depends(get_db)
):
    if format not in ("csv", "xml"):
        raise HTTPException(status_code=400, detail="format must be csv or xml")

    rows = db.execute(
        "SELECT p.purchased_at, prod.name, prod.generic_name, "
        "p.price, p.quantity, (p.price * p.quantity) AS subtotal, prod.is_qualified "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE strftime('%Y', p.purchased_at) = ? ORDER BY p.purchased_at",
        [str(year)],
    ).fetchall()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["購入日", "商品名", "一般名", "金額", "数量", "小計", "税制対象"])
        for r in rows:
            writer.writerow([
                r["purchased_at"], r["name"], r["generic_name"],
                r["price"], r["quantity"], r["subtotal"],
                "○" if r["is_qualified"] else "×",
            ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=medtax_{year}.csv"},
        )

    # XML
    root = ET.Element("医療費控除の明細書")
    root.set("年度", str(year))
    for r in rows:
        item = ET.SubElement(root, "明細")
        ET.SubElement(item, "購入日").text = r["purchased_at"]
        ET.SubElement(item, "商品名").text = r["name"]
        ET.SubElement(item, "一般名").text = r["generic_name"]
        ET.SubElement(item, "金額").text = str(r["subtotal"])
        ET.SubElement(item, "税制対象").text = "1" if r["is_qualified"] else "0"
    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return StreamingResponse(
        io.BytesIO(xml_bytes),
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=medtax_{year}.xml"},
    )
```

- [ ] **Step 4: テストがすべてパスすることを確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/ -v
```

Expected: 全テスト PASSED。

- [ ] **Step 5: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add backend/routers/tax.py backend/tests/test_tax.py
git commit -m "feat: add tax summary and CSV/XML export with tests"
```

---

## Task 6: フロントエンド雛形 + 共通コンポーネント

**Files:**
- Create: `frontend/` (Next.js scaffold)
- Create: `frontend/lib/api.ts`
- Create: `frontend/components/NavBar.tsx`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Next.js プロジェクトを作成**

```bash
cd /Users/ao/Desktop/smart-med-tax
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

Expected: `frontend/` が作成され `npm run dev` が動く雛形ができる。

- [ ] **Step 2: frontend/.env.local を作成**

`frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 3: frontend/lib/api.ts を作成**

`frontend/lib/api.ts`:
```typescript
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// SQLite returns is_qualified as 0 or 1 (integer). Both are treated as
// truthy/falsy in JS, so conditional rendering (product.is_qualified ? ...) works.
export type Product = {
  jan_code: string;
  name: string;
  generic_name: string;
  efficacy: string;
  category: string;
  is_qualified: number; // 1 = qualified, 0 = not qualified
};

export type Purchase = {
  id: number;
  jan_code: string;
  product_name: string;
  price: number;
  quantity: number;
  purchased_at: string;
  store_name: string | null;
  is_qualified: number; // 1 = qualified, 0 = not qualified
};

export type TaxSummary = {
  year: number;
  total_qualified: number;
  deductible_amount: number;
  threshold: number;
  is_qualified: boolean;
};

export async function lookupJan(code: string): Promise<Product> {
  const res = await fetch(`${API_BASE}/api/jan/${code}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "検索に失敗しました");
  }
  return res.json();
}

export async function addPurchase(data: {
  jan_code: string;
  price: number;
  quantity: number;
  purchased_at: string;
  store_name?: string;
}): Promise<Purchase> {
  const res = await fetch(`${API_BASE}/api/purchases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "追加に失敗しました");
  }
  return res.json();
}

export async function getPurchases(year: number): Promise<Purchase[]> {
  const res = await fetch(`${API_BASE}/api/purchases?year=${year}`);
  if (!res.ok) throw new Error("購入履歴の取得に失敗しました");
  return res.json();
}

export async function getTaxSummary(year: number): Promise<TaxSummary> {
  const res = await fetch(`${API_BASE}/api/tax/summary?year=${year}`);
  if (!res.ok) throw new Error("税制サマリの取得に失敗しました");
  return res.json();
}

export function getTaxExportUrl(
  year: number,
  format: "csv" | "xml"
): string {
  return `${API_BASE}/api/tax/export?year=${year}&format=${format}`;
}
```

- [ ] **Step 4: frontend/components/NavBar.tsx を作成**

`frontend/components/NavBar.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/scan", label: "スキャン", icon: "📷" },
  { href: "/history", label: "履歴", icon: "📋" },
  { href: "/tax", label: "税制", icon: "📊" },
] as const;

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="max-w-md mx-auto flex">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-3 text-xs gap-0.5 ${
              pathname === item.href
                ? "text-indigo-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: frontend/app/layout.tsx を更新**

`frontend/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Smart Med-Tax",
  description: "セルフメディケーション税制支援アプリ",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        {children}
        <NavBar />
      </body>
    </html>
  );
}
```

- [ ] **Step 6: フロントの起動確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/frontend
npm run dev
```

Expected: `http://localhost:3000` でNext.jsデフォルト画面が表示される。Ctrl+C で停止。

- [ ] **Step 7: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
echo "frontend/.env.local" >> .gitignore
git add frontend/ .gitignore
git commit -m "feat: scaffold Next.js frontend with API client and NavBar"
```

---

## Task 7: ホーム画面（ダッシュボード）

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: frontend/app/page.tsx を実装**

`frontend/app/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getTaxSummary, type TaxSummary } from "@/lib/api";

const THRESHOLD = 12_000;
const YEAR = new Date().getFullYear();

export default function HomePage() {
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTaxSummary(YEAR)
      .then(setSummary)
      .catch((e: Error) => setError(e.message));
  }, []);

  const total = summary?.total_qualified ?? 0;
  const progress = Math.min((total / THRESHOLD) * 100, 100);
  const remaining = Math.max(0, THRESHOLD - total);

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Smart Med-Tax</h1>

      {summary?.is_qualified && (
        <div
          className="bg-green-100 text-green-800 rounded-xl p-4 mb-4 font-semibold text-sm"
          data-testid="qualified-banner"
        >
          🎉 控除対象になりました！申告データを出力できます。
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1" data-testid="year-label">
          {YEAR}年 セルフメディケーション累計
        </p>
        <p
          className="text-4xl font-bold text-indigo-600 mb-3"
          data-testid="total-amount"
        >
          ¥{total.toLocaleString()}
        </p>
        <div className="bg-gray-200 rounded-full h-3 mb-2">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
            data-testid="progress-bar"
          />
        </div>
        <p className="text-xs text-gray-500">
          控除まであと ¥{remaining.toLocaleString()}（目標: ¥
          {THRESHOLD.toLocaleString()}）
        </p>
      </div>

      <Link
        href="/scan"
        className="block w-full bg-indigo-600 text-white text-center py-4 rounded-xl font-semibold text-lg mb-4 active:bg-indigo-700"
        data-testid="scan-link"
      >
        📷 JANコードを読み取る
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/history"
          className="bg-white rounded-xl shadow p-4 text-center text-sm font-medium text-gray-700"
        >
          📋 購入履歴
        </Link>
        <Link
          href="/tax"
          className="bg-white rounded-xl shadow p-4 text-center text-sm font-medium text-gray-700"
        >
          📊 税制レポート
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: バックエンドを起動してホーム画面を確認**

```bash
# ターミナル1
cd /Users/ao/Desktop/smart-med-tax/backend
uv run uvicorn main:app --port 8000

# ターミナル2
cd /Users/ao/Desktop/smart-med-tax/frontend
npm run dev
```

`http://localhost:3000` を開き、累計¥0のダッシュボードが表示されることを確認。

- [ ] **Step 3: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/app/page.tsx
git commit -m "feat: add home dashboard with tax progress bar"
```

---

## Task 8: JANスキャン画面

**Files:**
- Create: `frontend/app/scan/page.tsx`

- [ ] **Step 1: frontend/app/scan/page.tsx を実装**

`frontend/app/scan/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { lookupJan, addPurchase, type Product } from "@/lib/api";

const today = () => new Date().toISOString().split("T")[0];

export default function ScanPage() {
  const [janCode, setJanCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [price, setPrice] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(today());
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLookup() {
    const code = janCode.trim();
    if (!code) return;
    setError(null);
    setProduct(null);
    setSuccess(false);
    try {
      setProduct(await lookupJan(code));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "検索に失敗しました");
    }
  }

  async function handleAdd() {
    if (!product || !price) return;
    setLoading(true);
    setError(null);
    try {
      await addPurchase({
        jan_code: product.jan_code,
        price: parseInt(price, 10),
        quantity: 1,
        purchased_at: purchasedAt,
        store_name: storeName || undefined,
      });
      setSuccess(true);
      setJanCode("");
      setProduct(null);
      setPrice("");
      setStoreName("");
      setPurchasedAt(today());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">JANスキャン</h1>

      {success && (
        <div
          className="bg-green-100 text-green-800 rounded-xl p-3 mb-4 text-sm font-medium"
          data-testid="success-message"
        >
          ✓ 薬箱に追加しました
        </div>
      )}

      {error && (
        <div
          className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm"
          data-testid="error-message"
        >
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          JANコード（13桁）
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={janCode}
            onChange={(e) => setJanCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="例: 4987117709559"
            data-testid="jan-input"
          />
          <button
            onClick={handleLookup}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium active:bg-indigo-700"
            data-testid="lookup-button"
          >
            検索
          </button>
        </div>
      </div>

      {product && (
        <div
          className="bg-white rounded-xl shadow p-6 mb-4"
          data-testid="product-info"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 mr-3">
              <h2 className="font-bold text-base" data-testid="product-name">
                {product.name}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{product.generic_name}</p>
              <p className="text-xs text-gray-400 mt-1">{product.efficacy}</p>
            </div>
            {product.is_qualified ? (
              <span
                className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap"
                data-testid="qualified-badge"
              >
                ✓ 税制対象
              </span>
            ) : (
              <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                対象外
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                購入金額（円）
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="980"
                data-testid="price-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">購入日</label>
              <input
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">
              店舗名（任意）
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="マツキヨ渋谷店"
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={!price || loading}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 active:bg-green-700"
            data-testid="add-button"
          >
            {loading ? "追加中..." : "薬箱に追加する"}
          </button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: スキャン画面を手動確認**

`http://localhost:3000/scan` を開き、以下を確認：
1. JANコード `4987117709559` を入力して「検索」→「ロキソニンS 12錠」と「✓ 税制対象」バッジが表示される
2. 金額 `980` を入力して「薬箱に追加する」→「✓ 薬箱に追加しました」が表示される
3. ホームに戻ると累計が ¥980 に更新される

- [ ] **Step 3: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/app/scan/
git commit -m "feat: add JAN scan page with product lookup and purchase form"
```

---

## Task 9: 購入履歴画面 + 税制レポート画面

**Files:**
- Create: `frontend/app/history/page.tsx`
- Create: `frontend/app/tax/page.tsx`

- [ ] **Step 1: frontend/app/history/page.tsx を実装**

`frontend/app/history/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { getPurchases, type Purchase } from "@/lib/api";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function HistoryPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [qualifiedOnly, setQualifiedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    getPurchases(year)
      .then(setPurchases)
      .catch((e: Error) => setError(e.message));
  }, [year]);

  const displayed = qualifiedOnly
    ? purchases.filter((p) => p.is_qualified)
    : purchases;

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">購入履歴</h1>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          data-testid="year-select"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={qualifiedOnly}
            onChange={(e) => setQualifiedOnly(e.target.checked)}
            className="rounded"
          />
          税制対象品目のみ
        </label>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {displayed.length === 0 ? (
        <p className="text-gray-400 text-center py-16 text-sm">
          購入記録がありません
        </p>
      ) : (
        <div
          className="bg-white rounded-xl shadow overflow-hidden"
          data-testid="purchase-list"
        >
          {displayed.map((p, i) => (
            <div
              key={p.id}
              className={`flex justify-between items-center px-4 py-3 ${
                i < displayed.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <div>
                <p className="font-medium text-sm">{p.product_name}</p>
                <p className="text-xs text-gray-400">
                  {p.purchased_at}
                  {p.store_name ? ` · ${p.store_name}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-amber-600 text-sm">
                  ¥{p.price.toLocaleString()}
                </p>
                {p.is_qualified ? (
                  <span className="text-xs text-green-600">税制対象</span>
                ) : (
                  <span className="text-xs text-gray-400">対象外</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: frontend/app/tax/page.tsx を実装**

`frontend/app/tax/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { getTaxSummary, getTaxExportUrl, type TaxSummary } from "@/lib/api";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function TaxPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    getTaxSummary(year)
      .then(setSummary)
      .catch((e: Error) => setError(e.message));
  }, [year]);

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">税制レポート</h1>

      <div className="mb-4">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          data-testid="year-select"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {summary && (
        <>
          {summary.is_qualified && (
            <div
              className="bg-green-100 text-green-800 rounded-xl p-4 mb-4 font-semibold text-sm"
              data-testid="qualified-banner"
            >
              🎉 控除対象です！{year}年の申告データを出力してください。
            </div>
          )}

          <div className="bg-white rounded-xl shadow p-6 mb-4">
            <h2 className="text-xs text-gray-500 mb-4">
              {year}年 セルフメディケーション税制
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">対象品目購入額</p>
                <p
                  className="text-2xl font-bold text-red-600"
                  data-testid="total-qualified"
                >
                  ¥{summary.total_qualified.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">控除可能額</p>
                <p
                  className="text-2xl font-bold text-indigo-600"
                  data-testid="deductible-amount"
                >
                  {summary.deductible_amount > 0
                    ? `¥${summary.deductible_amount.toLocaleString()}`
                    : "—"}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">
              ※ ¥{summary.threshold.toLocaleString()}超で（合計額 − ¥
              {summary.threshold.toLocaleString()}）が控除対象
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={getTaxExportUrl(year, "csv")}
              className="bg-red-600 text-white rounded-xl p-4 text-center font-semibold text-sm active:bg-red-700"
              data-testid="csv-download"
            >
              📄 CSV出力
            </a>
            <a
              href={getTaxExportUrl(year, "xml")}
              className="bg-violet-600 text-white rounded-xl p-4 text-center font-semibold text-sm active:bg-violet-700"
              data-testid="xml-download"
            >
              🗂 XML出力
            </a>
          </div>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: 両画面を手動確認**

- `http://localhost:3000/history` — 前のタスクで追加した購入が表示される
- `http://localhost:3000/tax` — 累計額と控除可能額が表示される。CSVダウンロードボタンをクリックしてファイルが落ちることを確認

- [ ] **Step 4: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/app/history/ frontend/app/tax/
git commit -m "feat: add history and tax report pages with CSV/XML export"
```

---

## Task 10: E2Eテスト（Playwright）

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/scan-flow.spec.ts`

- [ ] **Step 1: Playwright をインストール**

```bash
cd /Users/ao/Desktop/smart-med-tax/frontend
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: frontend/playwright.config.ts を作成**

`frontend/playwright.config.ts`:
```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  projects: [
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
```

> **注意:** E2Eテスト実行前に、バックエンド（port 8000）とフロントエンド（port 3000）を手動で起動しておくこと。

- [ ] **Step 3: frontend/e2e/scan-flow.spec.ts を作成**

`frontend/e2e/scan-flow.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

test.describe("JANスキャン → 購入追加 → ダッシュボード反映", () => {
  test("既知のJANコードで商品情報が表示され、追加後にホームの累計が増える", async ({
    page,
  }) => {
    // ホームの初期累計を確認
    await page.goto("/");
    const initialText = await page
      .getByTestId("total-amount")
      .textContent();
    const initialTotal = parseInt(
      (initialText ?? "0").replace(/[^0-9]/g, ""),
      10
    );

    // スキャンページへ移動
    await page.getByTestId("scan-link").click();
    await expect(page).toHaveURL("/scan");

    // JANコード入力
    await page.getByTestId("jan-input").fill("4987117709559");
    await page.getByTestId("lookup-button").click();

    // 商品情報の表示を確認
    await expect(page.getByTestId("product-info")).toBeVisible();
    await expect(page.getByTestId("product-name")).toContainText(
      "ロキソニンS 12錠"
    );
    await expect(page.getByTestId("qualified-badge")).toBeVisible();

    // 購入金額を入力して追加
    await page.getByTestId("price-input").fill("980");
    await page.getByTestId("add-button").click();

    // 成功メッセージを確認
    await expect(page.getByTestId("success-message")).toBeVisible();

    // ホームに戻り累計が増えていることを確認
    await page.goto("/");
    const newText = await page.getByTestId("total-amount").textContent();
    const newTotal = parseInt(
      (newText ?? "0").replace(/[^0-9]/g, ""),
      10
    );
    expect(newTotal).toBeGreaterThan(initialTotal);
  });

  test("未登録のJANコードでエラーメッセージが表示される", async ({ page }) => {
    await page.goto("/scan");
    await page.getByTestId("jan-input").fill("0000000000000");
    await page.getByTestId("lookup-button").click();
    await expect(page.getByTestId("error-message")).toBeVisible();
    await expect(page.getByTestId("error-message")).toContainText(
      "登録されていません"
    );
  });

  test("税制レポートページでCSVダウンロードリンクが存在する", async ({
    page,
  }) => {
    await page.goto("/tax");
    const csvLink = page.getByTestId("csv-download");
    await expect(csvLink).toBeVisible();
    const href = await csvLink.getAttribute("href");
    expect(href).toContain("format=csv");
  });
});
```

- [ ] **Step 4: バックエンドとフロントを起動してE2Eテストを実行**

```bash
# ターミナル1（すでに起動中でなければ）
cd /Users/ao/Desktop/smart-med-tax/backend
uv run uvicorn main:app --port 8000

# ターミナル2（すでに起動中でなければ）
cd /Users/ao/Desktop/smart-med-tax/frontend
npm run dev

# ターミナル3
cd /Users/ao/Desktop/smart-med-tax/frontend
npx playwright test
```

Expected:
```
  3 passed (xx.xs)
```

- [ ] **Step 5: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/playwright.config.ts frontend/e2e/
git commit -m "feat: add Playwright E2E tests for scan flow and tax report"
```

---

## 完了チェックリスト

- [ ] `uv run pytest` → 全テスト PASSED
- [ ] `npx playwright test` → 全E2EテストPASSED
- [ ] ホームで累計¥0表示、スキャンで追加後に累計が増える
- [ ] 税制レポートでCSVダウンロードが動作する
- [ ] モバイルサイズ（375px幅）でレイアウトが崩れない
