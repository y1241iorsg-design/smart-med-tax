# 要件定義書(2026-07-29版)への再整合 設計書

## 背景

2026-05-13〜2026-06-14にかけて構築されたSmart Med-Tax(FastAPI + Next.js + SQLite)に対し、
より詳細な要件定義書「SmartMedTax_Requirements_no_10_12」が提示された。
本書は、既存実装と新要件定義書を突き合わせた結果と、優先実装項目(4.1 AIチャット相談、
4.2 OTC医薬品レコメンド、4.3 OTC医薬品購入支援)に向けた再設計をまとめる。

**方針:** 新要件定義書を正とする。既存実装は要件と完全に一致する部分のみ再利用し、
ズレがある部分は要件に合わせて改修する。技術スタック(FastAPI/Next.js/SQLite)自体は
変更しない。

---

## 既存実装の仕分け結果

| 要件書の機能 | 既存実装 | 分類 | ズレ内容 |
|---|---|---|---|
| 4.1 AIチャット相談 | `chat.py`(人間へのエスカレーション判定のみ) | 改修(実質新規) | 症状キーワードを商品DBの「効能・効果」と照合する機能がない |
| 4.2 OTC医薬品レコメンド | `symptom.py`(症状チェックボックス→固定マッピング、Gemini有効時はAIが3〜4品を選定し理由付けする) | 改修 | ①Geminiによる選定・理由付けが「AIスコアリング禁止」要件に**違反** ②添付文書PDFリンク/副作用フィールドが商品DBにない ③年齢・性別考慮なし ④レスポンスが整形テキストで構造化されていない |
| 4.3 OTC医薬品購入支援 | `purchases.py`(履歴CRUDのみ) | 改修(実質新規) | 購入ページ遷移・複数購入先一覧・在庫/価格モック表示が未実装 |
| 4.5 お薬手帳 | `purchases.py` | 軽微改修 | `使用目的`・`メモ`カラムがない |
| 4.6 税制支援 | `tax.py` | ほぼ維持 | 控除上限(¥88,000)未適用 |
| 4.4 飲み合わせチェック / 4.7 薬局検索 / 4.9〜4.11 / 5.1コンシェルジュ | 未実装 | 新規(本フェーズ対象外、将来フェーズ) | — |
| `inventory.py` / `receipt.py` | 実装済みだが要件書に明記なし | 現状維持 | 優先度最下位のため今回は触らない |

**コンプライアンス上の懸念:** `gemini_client.py`のシステムプロンプトが「飲み合わせの可否を
具体的に回答する」「最適な薬を選ぶ」等、要件書が禁止する“判定”寄りの文言になっている。
本フェーズで是正する。

---

## スコープ(本フェーズ)

### 対象
- 4.1 AIチャット相談機能
- 4.2 OTC医薬品レコメンド機能
- 4.3 OTC医薬品購入支援機能
- 4.5 OTCお薬手帳機能(購入時のuse_purpose/memo追加という付随修正)
- 安全性文言(表現上の注意)の是正

### 対象外(将来フェーズ)
4.4 飲み合わせチェック、4.6税制支援(控除上限¥88,000の適用を含む、現行実装のまま変更しない)、
4.7薬局検索、4.8 JANカメラ読取UI、4.9家族共有、4.10フォローアップ、4.11養生アドバイス、
5.1コンシェルジュ、5.2監修Bot

---

## データモデル変更

### `products` テーブルに列追加
```sql
ALTER TABLE products ADD COLUMN dosage TEXT NOT NULL DEFAULT '';        -- 用法・用量
ALTER TABLE products ADD COLUMN side_effects TEXT NOT NULL DEFAULT ''; -- 副作用(添付文書の記載をそのまま転記)
ALTER TABLE products ADD COLUMN precautions TEXT NOT NULL DEFAULT ''; -- してはいけないこと/相談すること
ALTER TABLE products ADD COLUMN pdf_url TEXT NOT NULL DEFAULT '';      -- 添付文書PDFへの外部リンク
ALTER TABLE products ADD COLUMN price INTEGER NOT NULL DEFAULT 0;      -- 参考価格(検索結果の並び替え用)
```
既存の `data/jan_mock.py` の全24品目に、上記フィールドの実データ(公開情報ベース)を追加する。
添付文書PDFリンクは各製薬会社/PMDA公開の実URLを使用する。

### `purchases` テーブルに列追加
```sql
ALTER TABLE purchases ADD COLUMN purpose TEXT;  -- 使用目的
ALTER TABLE purchases ADD COLUMN memo TEXT;     -- メモ
```

### 新テーブル `vendors`(購入支援用モック在庫/価格)
```sql
CREATE TABLE vendor_listings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    jan_code   TEXT NOT NULL REFERENCES products(jan_code),
    store_name TEXT NOT NULL,
    price      INTEGER NOT NULL,
    in_stock   INTEGER NOT NULL DEFAULT 1,
    url        TEXT NOT NULL  -- 購入ページ(モック)へのリンク
);
```
各商品に2〜3件のモック購入先(店舗名・価格・在庫有無・リンク)をシードする。

---

## API設計

### `POST /api/chat`(全面改修)
チャット形式で症状・年齢・性別・アレルギー/服薬中の薬を収集する会話エンドポイント。
ステートレス設計とし、フロントが会話履歴(ターン配列)を毎回送信する。

**リクエスト**
```json
{
  "history": [
    {"role": "user", "text": "頭痛がひどい"}
  ],
  "profile": {"age": 48, "sex": "female", "allergies": [], "current_meds": []}
}
```

**処理**
1. 直近の発話から重篤キーワード(息苦しい、意識障害、高熱持続、激しい腹痛 等)を検知。
   該当すれば`escalate: true`と受診推奨メッセージ(要件書「表現上の注意」の文言テンプレート)を
   即座に返し、以降の質問をスキップする。
2. 重篤キーワードがなければ、未収集の情報(症状カテゴリ→年齢/性別→アレルギー/服薬中の薬)を
   1問ずつ質問する応答を返す(固定の質問テンプレート、Geminiは使わない)。
3. 症状カテゴリが確定した時点で `ready_for_search: true` と抽出済み症状キーワード配列を返す。
   Geminiは「症状のゆらぎ表現(例:頭がガンガンする)」を9種の症状カテゴリへの正規化にのみ
   使用し、商品選定・スコアリングには一切使用しない(利用不可時は簡易キーワード辞書で代替)。

**レスポンス**
```json
{
  "reply": "いつ頃から続いていますか?他に気になる症状はありますか?",
  "escalate": false,
  "ready_for_search": false,
  "extracted_symptoms": []
}
```

### `POST /api/products/search`(`symptom.py`を置き換え)
純粋なキーワード照合。AIによる選定・理由付けは行わない。

**リクエスト**
```json
{ "symptoms": ["頭痛・発熱"], "age": 48, "sex": "female", "current_meds": [] }
```

**処理**
1. `symptoms`の各カテゴリに紐づく商品を`products`テーブルから取得
   (カテゴリ→効能・効果の部分一致検索。ハードコードされたJANマッピングではなく、
   `efficacy`列に対する`LIKE`検索ベースに変更し、将来の商品追加に耐える構造にする)
2. `current_meds`と成分が重複する商品がある場合は結果に警告フラグを付与するのみ
   (除外や判定はしない。4.4本実装は将来フェーズ)
3. 価格昇順→一般名順でソートして返す(AIによる並び替えは行わない)

**レスポンス:** 商品オブジェクトの配列(name, generic_name, efficacy, dosage, side_effects,
precautions, pdf_url, price, is_qualified)

### `GET /api/products/{jan_code}/vendors`(新規)
モック購入先一覧(店舗名、価格、在庫有無、購入リンク)を返す。

### `PATCH /api/purchases`(既存拡張)
`purpose`, `memo` を受け付けるようリクエストモデルを拡張。

---

## フロントエンド設計

| 画面 | 変更内容 |
|---|---|
| `/chat`(全面改修) | LINE風チャットUIで症状・属性を収集。重篤検知時は即座に受診推奨バナーを最上部固定表示。収集完了後「検索結果を見る」ボタンで`/search`へ遷移 |
| `/search`(新規、`/symptom`を置き換え) | 商品カードの並列一覧(画像プレースホルダ、商品名、カテゴリ、効能・効果、注意事項要約、価格、購入ボタン、お薬手帳登録ボタン)。価格/成分名でのソート切替のみ(推奨順は提供しない) |
| `/products/[jan_code}`(新規) | 添付文書相当の全情報(効能・効果、用法・用量、成分、副作用、してはいけないこと)+ 添付文書PDFへの外部リンク(必須) + 購入先一覧(複数店舗) + 「お薬手帳に登録」ボタン |
| `/history`(既存拡張) | 購入登録フォームに使用目的・メモ入力欄を追加 |

---

## 安全性文言の是正

- `gemini_client.py`のSYSTEM_PROMPTから「具体的な可否を答える」「最適な薬を選ぶ」等の
  断定的指示を削除し、要件書「表現上の注意」表の言い回しに統一する
- 症状カテゴリ正規化用途に限定した新しいプロンプトに差し替える
- 重篤キーワード検知/受診推奨メッセージはコード上でテンプレート化し、テストで文言の
  逸脱がないことを検証する

---

## テスト方針

- Backend: pytest — `/api/chat`(重篤検知、質問フロー、症状正規化)、`/api/products/search`
  (キーワード照合、ソート順、AIが選定プロセスに関与しないことの検証)、
  `/api/products/{jan}/vendors`、`/api/purchases`(purpose/memo)
- Frontend: 主要コンポーネントのレンダリングテスト
- E2E: Playwrightで「チャット開始→症状入力→検索結果→商品詳細→購入→お薬手帳登録」の
  一連のフローを検証(既存`chat-flow.spec.ts`等を更新)

---

## 未確定事項

- 添付文書PDFの実URLは製薬会社/PMDA公開情報から手作業で収集する(自動スクレイピングは
  対象外。件数は既存24品目分)
- `inventory.py`/`receipt.py`は要件書に明記がないため今回は変更しない
