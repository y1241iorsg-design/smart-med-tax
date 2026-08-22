# Smart Med-Tax

OTC医薬品の購入・お薬手帳管理、セルフメディケーション税制の申告支援、家族情報共有などを行うWebアプリです。
要件の詳細は [`teigi/SmartMedTax_Requirements_0802.md`](teigi/SmartMedTax_Requirements_0802.md) を参照してください。

- **公開デモ(モック版、バックエンド不要)**: https://y1241iorsg-design.github.io/smart-med-tax/
  - GitHub Pages上で動く静的なモックです。データは各自のブラウザの`localStorage`にだけ保存され、他の人とは共有されません。
  - `main`ブランチに変更をpushすると、GitHub Actionsが自動でビルド・再公開します(数十秒〜1分程度)。

## 構成

- `frontend/` : Next.js (React / TypeScript)
- `backend/` : FastAPI (Python) + SQLite

## セットアップ(ローカルで本物のアプリとして動かす)

### 必要なもの

- Node.js 20以上
- Python 3.11以上
- [uv](https://docs.astral.sh/uv/)（Pythonのパッケージ管理。無くても`pip`で代用可）

### 1. リポジトリを取得

```bash
git clone https://github.com/y1241iorsg-design/smart-med-tax.git
cd smart-med-tax
```

### 2. バックエンド(FastAPI)を起動

```bash
cd backend
uv sync            # 依存関係のインストール（uvが無い場合は python -m venv .venv && pip install -e . でも可）
uv run uvicorn main:app --reload --port 8000
```

起動すると `http://localhost:8000` でAPIが動きます(SQLiteのDBファイルは`backend/data/`に自動生成されます)。

### 3. フロントエンド(Next.js)を起動

別のターミナルで:

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:3000` を開くとアプリが使えます。`/api/*` へのアクセスは自動でバックエンド(`localhost:8000`)へ転送されます(`frontend/next.config.ts`のrewrites設定)。

## GitHub Pages向けモックについて(重要)

`https://y1241iorsg-design.github.io/smart-med-tax/` の公開デモは、上記のFastAPIバックエンドを使わず、`frontend/lib/mock/` 以下にロジックを移植した**静的モック**で動いています(`NEXT_PUBLIC_MOCK_MODE=1`でビルドすると自動的にこちらに切り替わります)。

- 通常の開発(`npm run dev` + バックエンド起動)では、モックは使われず本物のAPIを呼びます。
- **バックエンド(`backend/routers/*.py`)の挙動を変更した場合は、`frontend/lib/mock/api.ts`・`frontend/lib/mock/seedData.ts` も対応する内容に合わせて更新してください。** そうしないと、公開デモ(モック版)と実際のアプリの動作がズレてしまいます。
- モックのローカル動作確認は以下でできます:

```bash
cd frontend
NEXT_PUBLIC_MOCK_MODE=1 NEXT_PUBLIC_BASE_PATH=/smart-med-tax npm run build
npx serve out   # または任意の静的サーバーで out/ を配信して確認
```

## 開発の進め方

- 3人ともこのリポジトリに直接pushする形で進めます(小規模チームのため、ブランチ運用は最小限)。
- `main`にpushした内容はそのまま公開デモに反映されるので、大きく壊れる可能性がある変更は、一言声をかけてから進めると安心です。
- コミット前に以下を確認すると安全です:
  - フロントエンド: `cd frontend && npx tsc --noEmit` (型エラー確認)
  - バックエンド: `cd backend && uv run pytest` (テスト実行)
