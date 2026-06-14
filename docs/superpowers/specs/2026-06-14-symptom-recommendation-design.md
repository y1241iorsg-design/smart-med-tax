# 症状から薬を探す機能 設計書

## 概要

Smart Med-Tax に「症状選択 → Gemini AI によるOTC薬推薦」ページを追加する。
クスリナビ（https://helpful-quokka-21dcf4.netlify.app/）の UI を参考に、
既存のインジゴデザインを維持したまま `/symptom` ページとして実装する。

---

## ユーザーフロー

1. NavBar の「🔍 症状」タブをタップ
2. 症状を1つ以上選択（複数選択可）
3. 絞り込みオプションを任意で選択
4. 「おすすめ薬を探す」ボタンをタップ
5. Gemini AI が過去購入履歴を踏まえた提案を返す
6. 結果が同ページ下部にカード形式で表示される

---

## 症状リスト（9種）

- 頭痛・発熱
- 鼻水・鼻づまり
- のどの痛み
- 胃・腸の不調
- 目のかゆみ
- 肩こり・疲れ
- せき・たん
- 肌トラブル
- 睡眠・ストレス

## 絞り込みオプション（4種）

- 眠くなりにくい
- 漢方・ナチュラル系
- 過去購入品を優先
- 胃に優しい処方

---

## バックエンド設計

### エンドポイント

`POST /api/symptom/recommend`

**リクエスト**
```json
{
  "symptoms": ["頭痛・発熱", "鼻水・鼻づまり"],
  "filters": ["眠くなりにくい", "過去購入品を優先"]
}
```

**処理フロー**
1. `symptoms` が空なら 422 を返す
2. DBから直近1年の購入済み商品名を取得
3. Gemini に以下のプロンプトを送る：
   - 症状リスト
   - フィルター条件
   - 過去購入品リスト（文脈として渡す）
4. Gemini の回答テキストを `reply` として返す

**レスポンス**
```json
{
  "reply": "頭痛・発熱と鼻水・鼻づまりには...",
  "past_purchases_used": ["ロキソニンS 12錠", "新ルルAゴールドDX 30錠"]
}
```

**Gemini プロンプト設計**
```
あなたは日本のドラッグストアのAI薬剤アシスタントです。
以下の症状とご希望条件に合うOTC（市販）医薬品を3〜5品提案してください。

症状: {symptoms}
ご希望条件: {filters}
過去にご購入された薬（参考）: {past_purchases}

回答は以下の形式で日本語でお願いします：
- 薬品名（一般名）：理由を1〜2文で
処方箋医薬品・診断・治療は扱わないことを明示してください。
```

**モック回答**（GEMINI_API_KEY 未設定時）
```
（AI模擬応答）頭痛・発熱と鼻水・鼻づまりには以下をおすすめします。
・ロキソニンS（ロキソプロフェン）: 頭痛・発熱に速効性があります。眠くなりにくい成分です。
・新ルルAゴールドDX: 鼻水・鼻づまりを含む総合感冒薬です。
用法・用量を必ずご確認ください。処方箋医薬品の使用は医師にご相談ください。
```

---

## フロントエンド設計

### `/symptom` ページ（`frontend/app/symptom/page.tsx`）

**状態管理**
```typescript
selectedSymptoms: string[]   // 選択中の症状（複数可）
selectedFilters: string[]    // 選択中のフィルター（複数可）
result: string | null        // Geminiの回答テキスト
pastPurchases: string[]      // 回答に使われた過去購入品
loading: boolean
error: string | null
```

**UIコンポーネント構成**
```
<main>
  <h1>症状から薬を探す</h1>

  <!-- 症状選択グリッド -->
  <section>
    <p>今の症状（複数選択可）</p>
    <div class="grid grid-cols-3 gap-3">
      {SYMPTOMS.map(s => <SymptomChip />)}
    </div>
  </section>

  <!-- 絞り込みオプション -->
  <section>
    <p>絞り込みオプション</p>
    <div class="flex flex-wrap gap-2">
      {FILTERS.map(f => <FilterChip />)}
    </div>
  </section>

  <!-- 検索ボタン -->
  <button disabled={selectedSymptoms.length === 0}>
    🔍 おすすめ薬を探す
  </button>

  <!-- 結果表示 -->
  {result && (
    <div class="bg-white rounded-xl shadow p-4">
      <p class="whitespace-pre-wrap">{result}</p>
      {pastPurchases.length > 0 && (
        <p>参考にした過去購入品: {pastPurchases.join("、")}</p>
      )}
    </div>
  )}
</main>
```

**選択状態のスタイル**
- 未選択: `bg-white border border-gray-200 text-gray-700`
- 選択済み: `bg-indigo-50 border-2 border-indigo-500 text-indigo-700 font-semibold`

---

## NavBar 変更

`frontend/components/NavBar.tsx` に「🔍 症状」タブを追加（5→6タブ）。

```typescript
{ href: "/symptom", label: "症状", icon: "🔍" }
```

ホームと症状の間に配置：ホーム → 症状 → スキャン → 相談 → 履歴 → 税制

---

## API クライアント追加

`frontend/lib/api.ts` に追加：

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
  if (!res.ok) throw new Error("推薦の取得に失敗しました");
  return res.json();
}
```

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
|---------|------|------|
| `backend/routers/symptom.py` | 新規 | POST /api/symptom/recommend |
| `backend/tests/test_symptom.py` | 新規 | symptomルーターのテスト |
| `backend/main.py` | 変更 | symptomルーター登録 |
| `frontend/app/symptom/page.tsx` | 新規 | 症状選択・結果表示ページ |
| `frontend/components/NavBar.tsx` | 変更 | 🔍 症状タブ追加 |
| `frontend/lib/api.ts` | 変更 | getRecommendation追加 |

---

## 対象外（スコープ外）

- 受診判断ガイドページ
- マイページ
- 薬のデータベース検索（JANコード連携は既存機能で対応）
- プッシュ通知
