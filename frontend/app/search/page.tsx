"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { searchProducts, type ProductSearchResult } from "@/lib/api";

const SYMPTOMS = [
  { label: "頭痛・発熱", icon: "🌡️" },
  { label: "鼻水・鼻づまり", icon: "🤧" },
  { label: "のどの痛み", icon: "😮‍💨" },
  { label: "胃・腸の不調", icon: "🫁" },
  { label: "目のかゆみ", icon: "👁️" },
  { label: "肩こり・疲れ", icon: "💆" },
  { label: "せき・たん", icon: "😷" },
  { label: "肌トラブル", icon: "🧴" },
  { label: "睡眠・ストレス", icon: "😴" },
  { label: "更年期症状（ほてり・イライラ・動悸）", icon: "🌸" },
];

const FILTERS = [
  "眠くなりにくい",
  "漢方・ナチュラル系",
  "過去購入品を優先",
  "胃に優しい処方",
  "更年期・ホルモンケア向け",
];

function SearchPageInner() {
  const searchParams = useSearchParams();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [results, setResults] = useState<ProductSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromChat = searchParams.get("symptoms");
    if (fromChat) {
      const symptoms = decodeURIComponent(fromChat).split(",").filter(Boolean);
      if (symptoms.length > 0) {
        setSelectedSymptoms(symptoms);
        void runSearch(symptoms, []);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function runSearch(symptoms: string[], filters: string[]) {
    if (symptoms.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchProducts(symptoms, filters));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">薬を探す</h1>
        <p className="text-sm text-gray-500 mt-1">
          症状を選ぶとOTC医薬品を価格順に一覧表示します(推奨順ではありません)。
        </p>
      </div>

      <div className="flex gap-8 items-start">
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl shadow p-6 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              今の症状を選んでください <span className="text-xs font-normal text-gray-400">（複数選択可）</span>
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" data-testid="symptom-grid">
              {SYMPTOMS.map(({ label, icon }) => {
                const selected = selectedSymptoms.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => toggleSymptom(label)}
                    data-testid="symptom-chip"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      selected
                        ? "bg-indigo-50 border-2 border-indigo-500 text-indigo-700 font-semibold shadow-sm"
                        : "bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/40"
                    }`}
                  >
                    <span className="text-xl leading-none shrink-0">{icon}</span>
                    <span className="text-sm leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              絞り込みオプション <span className="text-xs font-normal text-gray-400">（任意）</span>
            </p>
            <div className="flex flex-wrap gap-2" data-testid="filter-chips">
              {FILTERS.map((label) => {
                const selected = selectedFilters.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => toggleFilter(label)}
                    data-testid="filter-chip"
                    className={`text-sm px-4 py-2 rounded-full border transition-all ${
                      selected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => runSearch(selectedSymptoms, selectedFilters)}
            disabled={selectedSymptoms.length === 0 || loading}
            data-testid="search-button"
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-base disabled:opacity-40 hover:bg-indigo-700 transition-colors"
          >
            {loading ? "検索中..." : "🔍 探す"}
          </button>

          {error && (
            <div className="bg-red-100 text-red-700 rounded-xl p-4 mt-4 text-sm" data-testid="error-message">
              {error}
            </div>
          )}

          {results && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6" data-testid="result-grid">
              {results.length === 0 ? (
                <p className="text-gray-400 text-sm col-span-2">
                  該当する商品が見つかりませんでした。薬剤師または登録販売者にご相談ください。
                </p>
              ) : (
                results.map((p) => (
                  <div key={p.jan_code} className="bg-white rounded-xl shadow p-5" data-testid="product-card">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-sm text-gray-900">{p.name}</h3>
                      {p.is_qualified ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                          税制対象
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{p.category}</p>
                    <p className="text-xs text-gray-600 mb-2">{p.efficacy}</p>
                    {p.overlap_warning && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mb-2" data-testid="overlap-warning">
                        ⚠ 服用中の薬と成分が重複する可能性があります。薬剤師にご相談ください。
                      </p>
                    )}
                    <p className="font-semibold text-amber-600 text-sm mb-3">¥{p.price.toLocaleString()}</p>
                    <Link
                      href={`/products/${p.jan_code}`}
                      className="block text-center bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                      data-testid="product-detail-link"
                    >
                      詳細・購入
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="hidden md:block w-80 xl:w-96 shrink-0 sticky top-20 bg-indigo-50 rounded-xl p-4 text-xs text-indigo-600 leading-relaxed">
          <p className="font-semibold text-indigo-700 mb-1">ご利用上の注意</p>
          本一覧は添付文書の効能・効果に基づく参考情報であり、特定の商品を推奨するものではありません。
          用法・用量は必ず添付文書をご確認ください。
        </div>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}
