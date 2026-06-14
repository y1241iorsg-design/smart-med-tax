# 症状から薬を探す（Gemini推薦）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smart Med-Tax に「症状選択 → Gemini AI OTC薬推薦」ページ `/symptom` を追加する

**Architecture:** バックエンドに `POST /api/symptom/recommend` を追加し、選択症状・フィルター・過去購入履歴を Gemini に渡して提案を生成する。フロントエンドは既存インジゴデザインを踏襲した症状選択グリッド＋結果カードを `/symptom` ページに実装し、NavBar に追加する。

**Tech Stack:** Python 3.11+, FastAPI, SQLite, google-genai, Next.js 16, React 19, TypeScript, Tailwind CSS 4

**ペルソナ反映ポイント:**
- 症状リストに「更年期症状（ほてり・イライラ・動悸）」を追加（10種）
- 絞り込みに「更年期・ホルモンケア向け」を追加（5種）
- Gemini プロンプトに「多忙で通院できない40代女性」コンテキストを組み込み
- コピーを「忙しくて病院に行けない方へ」に設定

---

## ファイルマップ

| ファイル | 種別 | 責務 |
|---------|------|------|
| `backend/routers/symptom.py` | 新規 | POST /api/symptom/recommend |
| `backend/tests/test_symptom.py` | 新規 | symptom ルーターのユニットテスト |
| `backend/main.py` | 変更 | symptom ルーター登録 |
| `frontend/app/symptom/page.tsx` | 新規 | 症状選択・フィルター・結果表示 |
| `frontend/components/NavBar.tsx` | 変更 | 🔍 症状タブ追加（6タブ化） |
| `frontend/lib/api.ts` | 変更 | `getRecommendation` 追加 |

---

## Task 1: バックエンド symptom ルーター

**Files:**
- Create: `backend/routers/symptom.py`
- Create: `backend/tests/test_symptom.py`
- Modify: `backend/main.py`

- [ ] **Step 1: テストを書く**

`backend/tests/test_symptom.py` を新規作成：

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


def test_recommend_returns_reply(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    resp = client.post("/api/symptom/recommend", json={
        "symptoms": ["頭痛・発熱"],
        "filters": []
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert isinstance(data["reply"], str)
    assert len(data["reply"]) > 0


def test_recommend_includes_past_purchases_field(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    resp = client.post("/api/symptom/recommend", json={
        "symptoms": ["胃・腸の不調"],
        "filters": ["過去購入品を優先"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "past_purchases_used" in data
    assert isinstance(data["past_purchases_used"], list)


def test_recommend_uses_purchase_history(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    # 購入履歴を追加
    client.post("/api/purchases", json={
        "jan_code": "4987117709559",
        "price": 980,
        "quantity": 1,
        "purchased_at": "2026-05-01",
    })
    resp = client.post("/api/symptom/recommend", json={
        "symptoms": ["頭痛・発熱"],
        "filters": ["過去購入品を優先"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "ロキソニンS 12錠" in data["past_purchases_used"]


def test_recommend_empty_symptoms_returns_422(client):
    resp = client.post("/api/symptom/recommend", json={
        "symptoms": [],
        "filters": []
    })
    assert resp.status_code == 422


def test_recommend_missing_symptoms_returns_422(client):
    resp = client.post("/api/symptom/recommend", json={"filters": []})
    assert resp.status_code == 422


def test_recommend_with_filters(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    resp = client.post("/api/symptom/recommend", json={
        "symptoms": ["更年期症状（ほてり・イライラ・動悸）"],
        "filters": ["更年期・ホルモンケア向け", "漢方・ナチュラル系"]
    })
    assert resp.status_code == 200
    assert len(resp.json()["reply"]) > 0
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_symptom.py -v
```

Expected: `ImportError` または `404` で FAILED

- [ ] **Step 3: symptom ルーターを実装**

`backend/routers/symptom.py` を新規作成：

```python
import sqlite3
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from db import get_db
from gemini_client import ask_gemini

router = APIRouter()

_SYMPTOM_MOCK = (
    "（AI模擬応答）ご選択の症状に合わせたOTC医薬品をご提案します。\n"
    "・ロキソニンS（ロキソプロフェン）: 頭痛・発熱に速効性があり、眠くなりにくい成分です。\n"
    "・新ルルAゴールドDX: 鼻水・のどの痛みを含む総合感冒薬です。\n"
    "・命の母A: 更年期症状（ほてり・イライラ・肩こり）に対応した漢方成分配合です。\n"
    "用法・用量を必ずご確認ください。症状が続く場合は医療機関へご相談ください。"
)

_PERSONA_CONTEXT = """
対象ユーザー：40代、多忙な管理職女性、通院が難しいためドラッグストアでセルフケアを希望。
更年期症状への関心が高く、眠くなりにくい・漢方など副作用に配慮した製品を好む。
2026年現在のOTCトレンド（更年期漢方、高機能サプリ、美容OTC）も考慮して提案すること。
"""


def _build_prompt(symptoms: list[str], filters: list[str], past_purchases: list[str]) -> str:
    symptoms_str = "、".join(symptoms)
    filters_str = "、".join(filters) if filters else "なし"
    purchases_str = "、".join(past_purchases) if past_purchases else "なし"
    return (
        f"{_PERSONA_CONTEXT}\n\n"
        f"症状: {symptoms_str}\n"
        f"ご希望条件: {filters_str}\n"
        f"過去にご購入された薬（参考）: {purchases_str}\n\n"
        "上記の症状とご希望に合うOTC（市販）医薬品を3〜5品ご提案ください。\n"
        "形式: 「・薬品名（一般名）: 理由を1〜2文」\n"
        "処方箋医薬品・診断・治療は扱わない旨を末尾に1行で明示してください。"
    )


def _fetch_past_purchases(db: sqlite3.Connection) -> list[str]:
    one_year_ago = (date.today() - timedelta(days=365)).isoformat()
    rows = db.execute(
        "SELECT DISTINCT prod.name "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE p.purchased_at >= ? ORDER BY p.purchased_at DESC LIMIT 10",
        [one_year_ago],
    ).fetchall()
    return [r["name"] for r in rows]


class SymptomRequest(BaseModel):
    symptoms: list[str] = Field(min_length=1)
    filters: list[str] = Field(default_factory=list)


class SymptomResponse(BaseModel):
    reply: str
    past_purchases_used: list[str]


@router.post("/symptom/recommend", response_model=SymptomResponse)
def recommend(body: SymptomRequest, db: sqlite3.Connection = Depends(get_db)) -> SymptomResponse:
    past = _fetch_past_purchases(db)
    prompt = _build_prompt(body.symptoms, body.filters, past)
    reply = ask_gemini(prompt) if True else _SYMPTOM_MOCK
    return SymptomResponse(reply=reply, past_purchases_used=past)
```

- [ ] **Step 4: main.py にルーターを追加**

`backend/main.py` の import 行を修正（既存）：

```python
from routers import jan, purchases, tax, chat, inventory, receipt, symptom
```

`app.include_router` の末尾に追加：

```python
app.include_router(symptom.router, prefix="/api")
```

- [ ] **Step 5: テストが通ることを確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/test_symptom.py -v
```

Expected: 6 tests PASSED

- [ ] **Step 6: 既存テストが壊れていないことを確認**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/ -v
```

Expected: 全テスト PASSED

- [ ] **Step 7: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add backend/routers/symptom.py backend/tests/test_symptom.py backend/main.py
git commit -m "feat: add symptom recommendation endpoint with Gemini AI"
```

---

## Task 2: フロントエンド API クライアント拡張

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: `getRecommendation` を api.ts に追加**

`frontend/lib/api.ts` の末尾に追記：

```typescript
export type SymptomRecommendation = {
  reply: string;
  past_purchases_used: string[];
};

export async function getRecommendation(
  symptoms: string[],
  filters: string[]
): Promise<SymptomRecommendation> {
  const res = await fetch(`${API_BASE}/api/symptom/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symptoms, filters }),
  });
  if (!res.ok) throw new Error("おすすめ薬の取得に失敗しました");
  return res.json();
}
```

- [ ] **Step 2: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/lib/api.ts
git commit -m "feat: add getRecommendation API client function"
```

---

## Task 3: `/symptom` ページ実装

**Files:**
- Create: `frontend/app/symptom/page.tsx`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p /Users/ao/Desktop/smart-med-tax/frontend/app/symptom
```

- [ ] **Step 2: ページを実装**

`frontend/app/symptom/page.tsx` を新規作成：

```tsx
"use client";
import { useState } from "react";
import { getRecommendation, type SymptomRecommendation } from "@/lib/api";

const SYMPTOMS = [
  { label: "頭痛・発熱",                   icon: "🌡️" },
  { label: "鼻水・鼻づまり",               icon: "🤧" },
  { label: "のどの痛み",                   icon: "😮‍💨" },
  { label: "胃・腸の不調",                 icon: "🫁" },
  { label: "目のかゆみ",                   icon: "👁️" },
  { label: "肩こり・疲れ",                 icon: "💆" },
  { label: "せき・たん",                   icon: "😷" },
  { label: "肌トラブル",                   icon: "🧴" },
  { label: "睡眠・ストレス",               icon: "😴" },
  { label: "更年期症状（ほてり・イライラ・動悸）", icon: "🌸" },
];

const FILTERS = [
  "眠くなりにくい",
  "漢方・ナチュラル系",
  "過去購入品を優先",
  "胃に優しい処方",
  "更年期・ホルモンケア向け",
];

export default function SymptomPage() {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [result, setResult] = useState<SymptomRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSymptom(label: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  }

  function toggleFilter(label: string) {
    setSelectedFilters((prev) =>
      prev.includes(label) ? prev.filter((f) => f !== label) : [...prev, label]
    );
  }

  async function handleSearch() {
    if (selectedSymptoms.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await getRecommendation(selectedSymptoms, selectedFilters);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-6 pb-24">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">症状から薬を探す</h1>
        <p className="text-xs text-gray-500 mt-1">
          忙しくて病院に行けない方へ。症状を選ぶだけでAIがOTC薬をご提案します。
        </p>
      </div>

      {/* 症状選択 */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-3">
          今の症状 <span className="text-xs text-gray-400">（複数選択可）</span>
        </p>
        <div className="grid grid-cols-2 gap-2" data-testid="symptom-grid">
          {SYMPTOMS.map(({ label, icon }) => {
            const selected = selectedSymptoms.includes(label);
            return (
              <button
                key={label}
                onClick={() => toggleSymptom(label)}
                data-testid={`symptom-${label}`}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                  selected
                    ? "bg-indigo-50 border-2 border-indigo-500 text-indigo-700 font-semibold"
                    : "bg-white border border-gray-200 text-gray-700"
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 絞り込みオプション */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-3">
          絞り込みオプション <span className="text-xs text-gray-400">（任意）</span>
        </p>
        <div className="flex flex-wrap gap-2" data-testid="filter-chips">
          {FILTERS.map((label) => {
            const selected = selectedFilters.includes(label);
            return (
              <button
                key={label}
                onClick={() => toggleFilter(label)}
                data-testid={`filter-${label}`}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selected
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white border-gray-300 text-gray-600"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 検索ボタン */}
      <button
        onClick={handleSearch}
        disabled={selectedSymptoms.length === 0 || loading}
        data-testid="search-button"
        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-base disabled:opacity-40 active:bg-indigo-700 mb-4"
      >
        {loading ? "AIが考えています..." : "🔍 おすすめ薬を探す"}
      </button>

      {/* エラー */}
      {error && (
        <div
          className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm"
          data-testid="error-message"
        >
          {error}
        </div>
      )}

      {/* 結果 */}
      {result && (
        <div className="bg-white rounded-xl shadow p-5" data-testid="result-card">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              AIアシスタント
            </span>
            <span className="text-xs text-gray-400">自動応答</span>
          </div>
          <p
            className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"
            data-testid="result-text"
          >
            {result.reply}
          </p>
          {result.past_purchases_used.length > 0 && (
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
              参考にした過去購入品：{result.past_purchases_used.join("、")}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/app/symptom/page.tsx
git commit -m "feat: add symptom recommendation page with 10 symptoms and 5 filters"
```

---

## Task 4: NavBar に症状タブを追加

**Files:**
- Modify: `frontend/components/NavBar.tsx`

- [ ] **Step 1: 現在の NavBar を確認**

`frontend/components/NavBar.tsx` の `NAV_ITEMS` は現在 5 項目：
```
ホーム / スキャン / 相談 / 履歴 / 税制
```

- [ ] **Step 2: 症状タブを追加（6タブ化）**

`frontend/components/NavBar.tsx` の `NAV_ITEMS` を以下に差し替え：

```typescript
const NAV_ITEMS = [
  { href: "/",        label: "ホーム",   icon: "🏠" },
  { href: "/symptom", label: "症状",     icon: "🔍" },
  { href: "/scan",    label: "スキャン", icon: "📷" },
  { href: "/chat",    label: "相談",     icon: "💬" },
  { href: "/history", label: "履歴",     icon: "📋" },
  { href: "/tax",     label: "税制",     icon: "📊" },
] as const;
```

- [ ] **Step 3: コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add frontend/components/NavBar.tsx
git commit -m "feat: add symptom tab to NavBar (6 tabs)"
```

---

## Task 5: 動作確認

- [ ] **Step 1: バックエンドを起動**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
pkill -f "uvicorn main:app" 2>/dev/null; sleep 1
uv run uvicorn main:app --port 8000 &
sleep 2
```

- [ ] **Step 2: エンドポイントを手動確認**

```bash
curl -s -X POST http://localhost:8000/api/symptom/recommend \
  -H "Content-Type: application/json" \
  -d '{"symptoms":["更年期症状（ほてり・イライラ・動悸）"],"filters":["漢方・ナチュラル系","更年期・ホルモンケア向け"]}' \
  | python3 -m json.tool
```

Expected: `reply` フィールドに提案テキスト、`past_purchases_used` がリスト

- [ ] **Step 3: フロントエンドを起動**

```bash
cd /Users/ao/Desktop/smart-med-tax/frontend
pkill -f "next dev" 2>/dev/null; sleep 1
npm run dev &
sleep 4
```

- [ ] **Step 4: ブラウザで確認**

http://localhost:3000/symptom を開き、以下を確認：
1. 症状グリッド（10個）が表示される
2. 「更年期症状（ほてり・イライラ・動悸）」をタップで選択（インジゴ強調）
3. 「漢方・ナチュラル系」フィルターをタップ
4. 「おすすめ薬を探す」ボタンが有効化される
5. タップで「AIが考えています...」→ 結果カード表示
6. NavBar に「🔍 症状」タブが表示される

- [ ] **Step 5: 全バックエンドテスト実行**

```bash
cd /Users/ao/Desktop/smart-med-tax/backend
uv run pytest tests/ -v
```

Expected: 全テスト PASSED（symptom 6件含む）

- [ ] **Step 6: 最終コミット**

```bash
cd /Users/ao/Desktop/smart-med-tax
git add -A
git commit -m "feat: symptom recommendation feature complete"
```
