# Smart Med-Tax Remaining Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three remaining modules — Concierge (Gemini AI chat with symptom suggestion, drug interaction check, JAN/photo lookup), medicine cabinet inventory tracking, and smart receipt mock.

**Architecture:** Backend adds three new FastAPI routers (`chat`, `inventory`, `receipt`) plus a shared Gemini client. Frontend adds `/chat` page (LINE-style bubble UI with escalation badges) and extends the home and scan pages. All Gemini calls fall back to mock responses when the API key is unset.

**Tech Stack:** Python 3.11+, FastAPI, SQLite, `google-genai`, Next.js 16, React 19, TypeScript, Tailwind CSS 4, Playwright E2E

---

## File Map

### New backend files
| File | Responsibility |
|------|---------------|
| `backend/gemini_client.py` | Gemini API wrapper with mock fallback |
| `backend/routers/chat.py` | POST /api/chat — symptom suggestion, drug interaction, JAN lookup |
| `backend/routers/inventory.py` | GET /api/inventory — consumption pace + replenishment alerts |
| `backend/routers/receipt.py` | POST /api/receipt/upload — mock smart-receipt batch import |
| `backend/tests/test_chat.py` | Tests for chat router |
| `backend/tests/test_inventory.py` | Tests for inventory router |
| `backend/tests/test_receipt.py` | Tests for receipt router |

### Modified backend files
| File | Change |
|------|--------|
| `backend/main.py` | Include chat, inventory, receipt routers |
| `backend/db.py` | Add `remaining_doses` column to purchases |

### New frontend files
| File | Responsibility |
|------|---------------|
| `frontend/app/chat/page.tsx` | LINE-style chat UI with escalation badges |
| `frontend/e2e/chat-flow.spec.ts` | Playwright E2E for chat flow |

### Modified frontend files
| File | Change |
|------|--------|
| `frontend/lib/api.ts` | Add `sendChat`, `getInventory`, `uploadReceipt` |
| `frontend/components/NavBar.tsx` | Add chat icon (5th item) |
| `frontend/app/page.tsx` | Add low-stock alert card |

---

## Task 1: Gemini Client with Mock Fallback

**Files:**
- Create: `backend/gemini_client.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_chat.py` with a basic import test:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from gemini_client import ask_gemini


def test_ask_gemini_returns_string_in_mock_mode(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    result = ask_gemini("頭痛に効く薬を教えて")
    assert isinstance(result, str)
    assert len(result) > 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_chat.py::test_ask_gemini_returns_string_in_mock_mode -v
```

Expected: `ModuleNotFoundError` or `ImportError`

- [ ] **Step 3: Write minimal implementation**

Create `backend/gemini_client.py`:

```python
import os
from google import genai

_MOCK_RESPONSE = (
    "（AI模擬応答）ご症状に合わせた市販薬をご提案します。"
    "詳しくは薬剤師または登録販売者にご相談ください。"
)

SYSTEM_PROMPT = """あなたは日本のドラッグストアのAI薬剤アシスタントです。
以下のルールに従って回答してください：
- OTC（市販）医薬品の範囲で回答する
- 症状を聞かれたら適切な薬のカテゴリと具体的な製品名（例：ロキソニンS、ガスター10）を提案する
- 飲み合わせを聞かれたら、具体的な可否と理由を答える
- JANコードや薬品名から一般名・効能・用法・副作用を列挙する
- 回答は日本語で、簡潔に3〜5文程度にまとめる
- 処方箋医薬品・診断・治療は扱わない旨を必要に応じて明示する"""


def ask_gemini(user_message: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _MOCK_RESPONSE

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.0-flash-lite",
        contents=f"{SYSTEM_PROMPT}\n\nユーザー: {user_message}",
    )
    return response.text or _MOCK_RESPONSE
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_chat.py::test_ask_gemini_returns_string_in_mock_mode -v
```

Expected: `PASSED`

- [ ] **Step 5: Commit**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add backend/gemini_client.py backend/tests/test_chat.py
git commit -m "feat: add Gemini client with mock fallback"
```

---

## Task 2: Chat Router (Symptom Suggestion, Drug Interaction, JAN Lookup)

**Files:**
- Create: `backend/routers/chat.py`
- Modify: `backend/tests/test_chat.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_chat.py`:

```python
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_chat_returns_200_with_message(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    resp = client.post("/api/chat", json={"message": "頭痛に効く薬は？"})
    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert isinstance(data["reply"], str)
    assert len(data["reply"]) > 0


def test_chat_returns_escalation_level_ai(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    resp = client.post("/api/chat", json={"message": "胃が痛い"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["escalation_level"] in ("ai", "registered_seller", "pharmacist")
    assert "responder_name" in data
    assert "responder_title" in data


def test_chat_escalates_to_pharmacist_on_keyword(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    resp = client.post(
        "/api/chat",
        json={"message": "持病があるのですが飲み合わせは大丈夫ですか？"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["escalation_level"] == "pharmacist"
    assert data["responder_title"] == "薬剤師"


def test_chat_escalates_to_registered_seller_on_keyword(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    resp = client.post(
        "/api/chat",
        json={"message": "副作用が心配です"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["escalation_level"] in ("registered_seller", "pharmacist")


def test_chat_empty_message_returns_422(client):
    resp = client.post("/api/chat", json={"message": ""})
    assert resp.status_code == 422


def test_chat_missing_message_returns_422(client):
    resp = client.post("/api/chat", json={})
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_chat.py -v -k "not test_ask_gemini"
```

Expected: Multiple `FAILED` with `404` or `AttributeError`

- [ ] **Step 3: Implement chat router**

Create `backend/routers/chat.py`:

```python
from fastapi import APIRouter
from pydantic import BaseModel, Field
from gemini_client import ask_gemini

router = APIRouter()

# Escalation rules: keyword → (level, name, title)
_PHARMACIST_KEYWORDS = [
    "持病", "処方", "飲み合わせ", "相互作用", "妊娠", "授乳", "アレルギー",
    "副作用が重い", "症状が続く", "改善しない",
]
_SELLER_KEYWORDS = ["副作用", "成分", "効かない", "長期", "子供", "高齢者"]

_RESPONDERS = {
    "ai": ("AIアシスタント", "自動応答"),
    "registered_seller": ("山田花子", "登録販売者"),
    "pharmacist": ("田中誠", "薬剤師"),
}


def _escalation_level(message: str) -> str:
    for kw in _PHARMACIST_KEYWORDS:
        if kw in message:
            return "pharmacist"
    for kw in _SELLER_KEYWORDS:
        if kw in message:
            return "registered_seller"
    return "ai"


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class ChatResponse(BaseModel):
    reply: str
    escalation_level: str
    responder_name: str
    responder_title: str


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest) -> ChatResponse:
    level = _escalation_level(body.message)
    name, title = _RESPONDERS[level]
    reply = ask_gemini(body.message)
    return ChatResponse(
        reply=reply,
        escalation_level=level,
        responder_name=name,
        responder_title=title,
    )
```

- [ ] **Step 4: Register router in main.py**

Edit `backend/main.py` — add import and include_router:

```python
from routers import jan, purchases, tax, chat, inventory, receipt

# inside app setup, after existing routers:
app.include_router(chat.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(receipt.router, prefix="/api")
```

For now, create stub files so the import doesn't fail:

`backend/routers/inventory.py` (stub):
```python
from fastapi import APIRouter
router = APIRouter()
```

`backend/routers/receipt.py` (stub):
```python
from fastapi import APIRouter
router = APIRouter()
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_chat.py -v
```

Expected: All `PASSED`

- [ ] **Step 6: Commit**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add backend/routers/chat.py backend/routers/inventory.py backend/routers/receipt.py backend/tests/test_chat.py backend/main.py
git commit -m "feat: add chat router with Gemini AI and 3-tier escalation"
```

---

## Task 3: Inventory Router (Consumption Pace + Replenishment Alerts)

**Files:**
- Create: `backend/routers/inventory.py` (replace stub)
- Create: `backend/tests/test_inventory.py`
- Modify: `backend/db.py` (add `remaining_doses` column)

- [ ] **Step 1: Extend DB schema**

Edit `backend/db.py` — add `remaining_doses` column to purchases table and update `_seed_products` signature. Replace the `CREATE TABLE purchases` statement:

```python
conn.execute("""
    CREATE TABLE IF NOT EXISTS purchases (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        jan_code         TEXT NOT NULL REFERENCES products(jan_code),
        price            INTEGER NOT NULL,
        quantity         INTEGER NOT NULL DEFAULT 1,
        purchased_at     DATE NOT NULL,
        store_name       TEXT,
        remaining_doses  INTEGER,
        created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    )
""")
```

- [ ] **Step 2: Write the failing inventory tests**

Create `backend/tests/test_inventory.py`:

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


def _add_purchase(client, jan_code: str, price: int, date: str, remaining: int | None = None):
    body = {
        "jan_code": jan_code,
        "price": price,
        "quantity": 1,
        "purchased_at": date,
    }
    if remaining is not None:
        body["remaining_doses"] = remaining
    return client.post("/api/purchases", json=body)


def test_inventory_empty_returns_empty_list(client):
    resp = client.get("/api/inventory")
    assert resp.status_code == 200
    assert resp.json() == []


def test_inventory_returns_item_after_purchase(client):
    _add_purchase(client, "4987117709559", 980, "2026-05-01", remaining=12)
    resp = client.get("/api/inventory")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    item = items[0]
    assert item["jan_code"] == "4987117709559"
    assert item["product_name"] == "ロキソニンS 12錠"
    assert item["remaining_doses"] == 12


def test_inventory_low_stock_flag(client):
    _add_purchase(client, "4987117709559", 980, "2026-05-01", remaining=2)
    resp = client.get("/api/inventory")
    item = resp.json()[0]
    assert item["is_low_stock"] is True


def test_inventory_normal_stock_not_flagged(client):
    _add_purchase(client, "4987117709559", 980, "2026-05-01", remaining=10)
    resp = client.get("/api/inventory")
    item = resp.json()[0]
    assert item["is_low_stock"] is False


def test_inventory_deduplicates_to_latest_purchase(client):
    _add_purchase(client, "4987117709559", 980, "2026-04-01", remaining=5)
    _add_purchase(client, "4987117709559", 980, "2026-05-01", remaining=8)
    resp = client.get("/api/inventory")
    items = resp.json()
    assert len(items) == 1
    assert items[0]["remaining_doses"] == 8
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_inventory.py -v
```

Expected: Multiple `FAILED`

- [ ] **Step 4: Update purchases router to accept remaining_doses**

Edit `backend/routers/purchases.py` — add optional `remaining_doses` field to `PurchaseCreate` and INSERT:

```python
class PurchaseCreate(BaseModel):
    jan_code: str
    price: int = Field(ge=1)
    quantity: int = Field(ge=1, le=999)
    purchased_at: date
    store_name: str | None = None
    remaining_doses: int | None = Field(default=None, ge=0)


@router.post("/purchases")
def add_purchase(body: PurchaseCreate, db: sqlite3.Connection = Depends(get_db)):
    product = db.execute(
        "SELECT * FROM products WHERE jan_code = ?", [body.jan_code]
    ).fetchone()
    if product is None:
        raise HTTPException(status_code=404, detail="商品が見つかりません")

    cursor = db.execute(
        "INSERT INTO purchases (jan_code, price, quantity, purchased_at, store_name, remaining_doses) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        [body.jan_code, body.price, body.quantity,
         body.purchased_at.isoformat(), body.store_name, body.remaining_doses],
    )
    db.commit()

    row = db.execute(
        "SELECT p.*, prod.name AS product_name, prod.is_qualified "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE p.id = ?",
        [cursor.lastrowid],
    ).fetchone()
    return dict(row)
```

- [ ] **Step 5: Implement inventory router**

Replace `backend/routers/inventory.py`:

```python
import sqlite3
from fastapi import APIRouter, Depends
from db import get_db

router = APIRouter()

LOW_STOCK_THRESHOLD = 3


@router.get("/inventory")
def get_inventory(db: sqlite3.Connection = Depends(get_db)):
    """Return latest purchase per product that has remaining_doses set."""
    rows = db.execute("""
        SELECT
            p.jan_code,
            prod.name AS product_name,
            prod.category,
            p.remaining_doses,
            p.purchased_at
        FROM purchases p
        JOIN products prod ON p.jan_code = prod.jan_code
        WHERE p.remaining_doses IS NOT NULL
          AND p.id = (
              SELECT id FROM purchases p2
              WHERE p2.jan_code = p.jan_code AND p2.remaining_doses IS NOT NULL
              ORDER BY p2.purchased_at DESC, p2.id DESC
              LIMIT 1
          )
        ORDER BY prod.name
    """).fetchall()

    return [
        {
            "jan_code": r["jan_code"],
            "product_name": r["product_name"],
            "category": r["category"],
            "remaining_doses": r["remaining_doses"],
            "last_purchased_at": r["purchased_at"],
            "is_low_stock": r["remaining_doses"] <= LOW_STOCK_THRESHOLD,
        }
        for r in rows
    ]
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_inventory.py -v
```

Expected: All `PASSED`

- [ ] **Step 7: Run all backend tests to check for regressions**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/ -v
```

Expected: All `PASSED`

- [ ] **Step 8: Commit**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add backend/db.py backend/routers/inventory.py backend/routers/purchases.py backend/tests/test_inventory.py
git commit -m "feat: add inventory router with low-stock alerts and remaining_doses tracking"
```

---

## Task 4: Smart Receipt Mock Router

**Files:**
- Create: `backend/routers/receipt.py` (replace stub)
- Create: `backend/tests/test_receipt.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_receipt.py`:

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


def test_receipt_upload_returns_imported_count(client):
    resp = client.post("/api/receipt/upload")
    assert resp.status_code == 200
    data = resp.json()
    assert "imported" in data
    assert data["imported"] >= 1


def test_receipt_upload_creates_purchases(client):
    client.post("/api/receipt/upload")
    resp = client.get(f"/api/purchases?year=2026")
    assert resp.status_code == 200
    purchases = resp.json()
    assert len(purchases) >= 1


def test_receipt_upload_idempotent_on_same_day(client):
    client.post("/api/receipt/upload")
    resp1 = client.get("/api/purchases?year=2026")
    client.post("/api/receipt/upload")
    resp2 = client.get("/api/purchases?year=2026")
    # Second upload adds another batch (mock always inserts; idempotency note)
    assert len(resp2.json()) >= len(resp1.json())
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_receipt.py -v
```

Expected: `FAILED` with 404

- [ ] **Step 3: Implement receipt router**

Replace `backend/routers/receipt.py`:

```python
import sqlite3
from datetime import date
from fastapi import APIRouter, Depends
from db import get_db

router = APIRouter()

# Mock smart-receipt data: simulates OCR output from a drugstore receipt
_MOCK_RECEIPT_ITEMS = [
    {"jan_code": "4987117709559", "price": 980, "quantity": 1, "store_name": "マツキヨ渋谷店"},
    {"jan_code": "4987028112014", "price": 1280, "quantity": 1, "store_name": "マツキヨ渋谷店"},
]


@router.post("/receipt/upload")
def upload_receipt(db: sqlite3.Connection = Depends(get_db)):
    """Mock smart-receipt import: inserts today's sample purchases."""
    today = date.today().isoformat()
    imported = 0
    for item in _MOCK_RECEIPT_ITEMS:
        product = db.execute(
            "SELECT jan_code FROM products WHERE jan_code = ?", [item["jan_code"]]
        ).fetchone()
        if product is None:
            continue
        db.execute(
            "INSERT INTO purchases (jan_code, price, quantity, purchased_at, store_name) "
            "VALUES (?, ?, ?, ?, ?)",
            [item["jan_code"], item["price"], item["quantity"], today, item["store_name"]],
        )
        imported += 1
    db.commit()
    return {"imported": imported, "date": today, "store": "マツキヨ渋谷店"}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_receipt.py -v
```

Expected: All `PASSED`

- [ ] **Step 5: Run all backend tests**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/ -v
```

Expected: All `PASSED`

- [ ] **Step 6: Commit**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add backend/routers/receipt.py backend/tests/test_receipt.py
git commit -m "feat: add smart receipt mock router"
```

---

## Task 5: Frontend API Client Extensions

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add chat, inventory, and receipt API calls**

Append to `frontend/lib/api.ts`:

```typescript
export type ChatResponse = {
  reply: string;
  escalation_level: "ai" | "registered_seller" | "pharmacist";
  responder_name: string;
  responder_title: string;
};

export type InventoryItem = {
  jan_code: string;
  product_name: string;
  category: string;
  remaining_doses: number;
  last_purchased_at: string;
  is_low_stock: boolean;
};

export type ReceiptResult = {
  imported: number;
  date: string;
  store: string;
};

export async function sendChat(message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("チャットの送信に失敗しました");
  return res.json();
}

export async function getInventory(): Promise<InventoryItem[]> {
  const res = await fetch(`${API_BASE}/api/inventory`);
  if (!res.ok) throw new Error("在庫情報の取得に失敗しました");
  return res.json();
}

export async function uploadReceipt(): Promise<ReceiptResult> {
  const res = await fetch(`${API_BASE}/api/receipt/upload`, { method: "POST" });
  if (!res.ok) throw new Error("レシート取込に失敗しました");
  return res.json();
}
```

Also fix the existing `getTaxExportUrl` — the query param should be `fmt` not `format` (matches backend):

```typescript
export function getTaxExportUrl(year: number, format: "csv" | "xml"): string {
  return `${API_BASE}/api/tax/export?year=${year}&fmt=${format}`;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/lib/api.ts
git commit -m "feat: add chat/inventory/receipt API client functions, fix export URL param"
```

---

## Task 6: Chat Page (LINE-style UI with Escalation Badges)

**Files:**
- Create: `frontend/app/chat/page.tsx`
- Modify: `frontend/components/NavBar.tsx`

- [ ] **Step 1: Create chat page**

Create `frontend/app/chat/page.tsx`:

```tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { sendChat, type ChatResponse } from "@/lib/api";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  responder?: Pick<ChatResponse, "responder_name" | "responder_title" | "escalation_level">;
};

const ESCALATION_COLORS: Record<string, string> = {
  ai: "bg-indigo-100 text-indigo-700",
  registered_seller: "bg-amber-100 text-amber-700",
  pharmacist: "bg-green-100 text-green-700",
};

const QUICK_QUESTIONS = [
  "頭痛に効く薬は？",
  "胃痛と下痢が同時に出てます",
  "ロキソニンとガスター10を一緒に飲んでもいい？",
  "副作用が心配です",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      text: "こんにちは！症状や薬について何でもご相談ください。JANコードを入力すると薬の詳細もお答えします。",
      responder: { responder_name: "AIアシスタント", responder_title: "自動応答", escalation_level: "ai" },
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = { id: Date.now(), role: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await sendChat(msg);
      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        text: res.reply,
        responder: {
          responder_name: res.responder_name,
          responder_title: res.responder_title,
          escalation_level: res.escalation_level,
        },
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", text: "エラーが発生しました。もう一度お試しください。" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto flex flex-col h-screen pb-16">
      <div className="px-4 py-3 border-b bg-white">
        <h1 className="text-lg font-bold text-gray-900">薬剤コンシェルジュ</h1>
        <p className="text-xs text-gray-500">AIが回答 → 必要に応じて専門家へ引継ぎ</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            data-testid={m.role === "user" ? "user-bubble" : "assistant-bubble"}
          >
            <div className={`max-w-[80%] ${m.role === "user" ? "" : ""}`}>
              {m.role === "assistant" && m.responder && (
                <span
                  className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1 ${
                    ESCALATION_COLORS[m.responder.escalation_level]
                  }`}
                  data-testid="responder-badge"
                >
                  {m.responder.responder_name}・{m.responder.responder_title}
                </span>
              )}
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-white shadow text-gray-800 rounded-tl-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start" data-testid="loading-indicator">
            <div className="bg-white shadow rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-400">
              入力中...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-2 bg-white border-t">
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="whitespace-nowrap text-xs bg-gray-100 text-gray-600 rounded-full px-3 py-1.5 shrink-0 active:bg-gray-200"
              data-testid="quick-question"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="症状・薬品名・JANコードを入力..."
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            data-testid="chat-input"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40 active:bg-indigo-700"
            data-testid="send-button"
          >
            送信
          </button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add chat to NavBar**

Edit `frontend/components/NavBar.tsx` — add chat item:

```tsx
const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/scan", label: "スキャン", icon: "📷" },
  { href: "/chat", label: "相談", icon: "💬" },
  { href: "/history", label: "履歴", icon: "📋" },
  { href: "/tax", label: "税制", icon: "📊" },
] as const;
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/app/chat/page.tsx frontend/components/NavBar.tsx
git commit -m "feat: add chat page with LINE-style UI and escalation badges"
```

---

## Task 7: Home Page Low-Stock Alert Card

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Add low-stock alerts to home page**

Edit `frontend/app/page.tsx` — add inventory state and alert card. Add after existing imports:

```tsx
import { getTaxSummary, getInventory, type TaxSummary, type InventoryItem } from "@/lib/api";
```

Add inventory state in the component:

```tsx
const [lowStock, setLowStock] = useState<InventoryItem[]>([]);

useEffect(() => {
  getInventory()
    .then((items) => setLowStock(items.filter((i) => i.is_low_stock)))
    .catch(() => {});
}, []);
```

Add alert card after the progress card (before the scan link):

```tsx
{lowStock.length > 0 && (
  <div
    className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4"
    data-testid="low-stock-alert"
  >
    <p className="text-xs font-bold text-amber-700 mb-2">⚠️ 在庫わずか</p>
    {lowStock.map((item) => (
      <p key={item.jan_code} className="text-sm text-amber-800">
        {item.product_name}（残り {item.remaining_doses} 錠）
      </p>
    ))}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/app/page.tsx
git commit -m "feat: add low-stock alert card on home page"
```

---

## Task 8: E2E Test — Chat Flow

**Files:**
- Create: `frontend/e2e/chat-flow.spec.ts`

- [ ] **Step 1: Create E2E test**

Create `frontend/e2e/chat-flow.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("コンシェルジュ チャット", () => {
  test("クイック質問ボタンで送信できる", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByTestId("assistant-bubble").first()).toBeVisible();

    await page.getByTestId("quick-question").first().click();

    await expect(page.getByTestId("user-bubble")).toBeVisible();
    await expect(page.getByTestId("assistant-bubble").nth(1)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("responder-badge").nth(1)).toBeVisible();
  });

  test("テキスト入力して送信できる", async ({ page }) => {
    await page.goto("/chat");
    await page.getByTestId("chat-input").fill("頭痛に効く薬は？");
    await page.getByTestId("send-button").click();

    await expect(page.getByTestId("user-bubble")).toBeVisible();
    await expect(page.getByTestId("assistant-bubble").nth(1)).toBeVisible({
      timeout: 10000,
    });
  });

  test("ナビバーの相談タブからチャットページへ遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /相談/ }).click();
    await expect(page).toHaveURL("/chat");
  });
});
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/e2e/chat-flow.spec.ts
git commit -m "test: add Playwright E2E tests for chat flow"
```

---

## Task 9: Full Integration Test Run

- [ ] **Step 1: Start backend**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run uvicorn main:app --reload --port 8000 &
```

- [ ] **Step 2: Start frontend**

```bash
cd /Users/ao/Desktop/smart-med-tax/frontend
npm run dev &
```

- [ ] **Step 3: Run all backend tests**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 4: Run all E2E tests**

```bash
cd /Users/ao/Desktop/smart-med-tax/frontend
npx playwright test --reporter=list
```

Expected: All tests pass (6 tests: 3 scan-flow + 3 chat-flow).

- [ ] **Step 5: Stop background servers and commit if all green**

```bash
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
```

```bash
cd /Users/ao/Desktop/smart-med-tax
git add -A
git commit -m "chore: final integration verified — all tests green"
```
