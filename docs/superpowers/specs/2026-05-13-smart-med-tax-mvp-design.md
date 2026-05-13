# Smart Med-Tax MVP 設計ドキュメント

**日付:** 2026-05-13
**スコープ:** MVPフェーズ — デジタル薬箱（JANスキャン）+ セルフメディケーション税制判定

---

## 1. 概要

ドラッグストアでOTC医薬品を購入する山田さん（48歳女性、スマホ利用者）向けのWebアプリ。
JANコードをスキャンして購入記録を蓄積し、セルフメディケーション税制（年間¥12,000超で控除）の
自動判定と申告データ出力を実現する。

**今回のMVPスコープ:**
- JANコード入力による商品情報取得と「税制対象品目」判定
- 購入履歴のSQLite永続化
- 年間累計額の自動計算と控除判定通知
- CSV/XML形式での申告データ出力

**スコープ外（将来フェーズ）:**
- AIコンシェルジュ（登録販売者エスカレーション）
- スマートレシート連携
- 在庫管理・補充通知
- ユーザー認証

---

## 2. アーキテクチャ

### 構成

```
smart-med-tax/
├── frontend/          # Next.js 14 (App Router, モバイルファースト)
├── backend/           # FastAPI + uv (Python 3.11+)
├── .env               # APIキー（GEMINI_API_KEY）
└── docs/
```

### 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| フロントエンド | Next.js 14 (App Router) | モバイルファースト、Tailwind CSS |
| バックエンド | FastAPI | uv パッケージマネージャー |
| データベース | SQLite | ローカルファイル `backend/data/medtax.db` |
| AI | gemini-3.1-flash-lite-preview | google-genai SDK（将来のコンシェルジュ機能向け） |
| 通信 | REST API (JSON) | フロントPort 3000 → バックPort 8000 |

### 起動

- フロント: `npm run dev` (port 3000)
- バック: `uv run uvicorn main:app --reload` (port 8000)

---

## 3. 画面構成

### ① ホーム / ダッシュボード (`/`)
- 今年のセルフメディケーション累計額をプログレスバーで表示
- 「控除まであと ¥X,XXX」（目標¥12,000）
- 累計が¥12,000を超えた場合は「控除対象になりました！」バナー
- 「JANコードを読み取る」ボタン（スキャン画面へ）

### ② JANスキャン / 商品追加 (`/scan`)
- JANコードのテキスト入力欄（将来的にカメラ対応）
- 入力後に商品情報を自動表示（名称・一般名・効能・税制対象フラグ）
- 購入金額・購入日の入力
- 「薬箱に追加する」ボタンで購入記録を保存

### ③ 購入履歴 (`/history`)
- 購入日・商品名・店舗・金額のリスト表示
- 年フィルタ（デフォルト: 今年）
- 税制対象品目のみ表示するトグル

### ④ 税制レポート (`/tax`)
- 年間対象購入額・控除可能額の表示
- 品目別内訳リスト
- CSV ダウンロードボタン（e-Tax用）
- XML ダウンロードボタン（将来のe-Tax直接連携向け）

---

## 4. APIエンドポイント

### バックエンド (FastAPI, Port 8000)

```
GET  /api/jan/{code}
  → JANコードで商品情報を返す（モックDB → 将来はリアルAPI）
  Response: { jan_code, name, generic_name, efficacy, category, is_qualified }

POST /api/purchases
  Body: { jan_code, price, quantity, purchased_at, store_name? }
  → 購入記録をSQLiteに保存
  Response: { id, ...購入情報 }

GET  /api/purchases?year=2026
  → 購入履歴一覧（年フィルタ）
  Response: [{ id, jan_code, product_name, price, quantity, purchased_at, is_qualified }]

GET  /api/tax/summary?year=2026
  → 年間対象額・控除可能額を計算して返す
  Response: { year, total_qualified, deductible_amount, threshold: 12000, is_qualified }

GET  /api/tax/export?year=2026&format=csv
  → CSV or XML ファイルをダウンロード
  CSVカラム: 購入日,商品名,一般名,金額,数量,小計,税制対象
  XMLスキーマ: e-Tax「医療費控除の明細書」準拠フォーマット
```

---

## 5. データモデル

### products テーブル（商品マスタ）

| カラム | 型 | 説明 |
|-------|-----|------|
| jan_code | TEXT PK | JANコード（13桁） |
| name | TEXT | 商品名（例: ロキソニンS 12錠） |
| generic_name | TEXT | 一般名（例: ロキソプロフェンNa水和物） |
| efficacy | TEXT | 効能・効果 |
| category | TEXT | 分類（解熱鎮痛・胃腸薬など） |
| is_qualified | BOOLEAN | セルフメディケーション税制対象フラグ |

### purchases テーブル（購入履歴）

| カラム | 型 | 説明 |
|-------|-----|------|
| id | INTEGER PK AUTOINCREMENT | |
| jan_code | TEXT FK | products.jan_code |
| price | INTEGER | 購入金額（円） |
| quantity | INTEGER | 購入数量（デフォルト1） |
| purchased_at | DATE | 購入日 |
| store_name | TEXT NULLABLE | 店舗名 |
| created_at | DATETIME | レコード作成日時 |

---

## 6. 税制判定ロジック

```python
# セルフメディケーション税制
THRESHOLD = 12_000  # 円

def calculate_tax_summary(year: int, db) -> dict:
    qualified_purchases = db.query(
        "SELECT SUM(price * quantity) FROM purchases p "
        "JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE prod.is_qualified = TRUE AND strftime('%Y', p.purchased_at) = ?"
        , [str(year)]
    )
    total = qualified_purchases or 0
    deductible = max(0, total - THRESHOLD)
    return {
        "year": year,
        "total_qualified": total,
        "deductible_amount": deductible,
        "threshold": THRESHOLD,
        "is_qualified": total >= THRESHOLD,
    }
```

---

## 7. モックデータ（初期JANコード）

MVPでは以下のOTC医薬品をモックDBとして実装。将来は外部APIに差し替え可能なインターフェースを持つ。

| JANコード | 商品名 | 一般名 | 税制対象 |
|-----------|-------|-------|---------|
| 4987117709559 | ロキソニンS 12錠 | ロキソプロフェンNa | ✓ |
| 4987028112014 | ガスター10 12錠 | ファモチジン | ✓ |
| 4901301254115 | バファリンA 20錠 | アスピリン | ✓ |
| 4987123704748 | ストッパ下痢止め | ロペラミド塩酸塩 | ✓ |
| 4901427016041 | 新ルルAゴールドDX | 総合感冒薬 | ✓ |
| 4903301069171 | ビタミンC 300錠 | アスコルビン酸 | ✗（対象外） |

---

## 8. エラーハンドリング

- JANコード未登録の場合: `404` + 「この商品は登録されていません。手動で追加できます。」
- バックエンド接続エラー: フロントエンドでトースト通知
- 税制対象外商品のスキャン: 記録はするが税制累計には加算しない（UI上で明示）

---

## 9. テスト方針

- **バックエンド**: pytest によるAPIエンドポイントの単体テスト（全エンドポイント網羅）
- **フロントエンド**: Playwright による E2E テスト
  - JANコード入力 → 商品表示 → 購入記録保存の一連フロー
  - 税制累計¥12,000超えでの通知表示
  - CSV エクスポートの動作確認

---

## 10. .env 設定

```
GEMINI_API_KEY=your_api_key_here
```

---

## 11. 将来フェーズへの拡張ポイント

1. **JANデータソース**: `backend/data/jan_mock.py` を `jan_api.py` に差し替えるだけで実APIに移行可能
2. **コンシェルジュ**: `/api/chat` エンドポイントを追加、Gemini SDK はすでに依存関係に含める
3. **認証**: FastAPI の Dependency Injection で後付け追加可能
4. **スマートレシート**: POST `/api/purchases/bulk` で一括登録に対応
