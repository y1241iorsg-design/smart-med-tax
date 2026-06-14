"use client";
import { useState } from "react";
import { getRecommendation, type SymptomRecommendation } from "@/lib/api";

const SYMPTOMS = [
  { label: "頭痛・発熱",                         icon: "🌡️" },
  { label: "鼻水・鼻づまり",                     icon: "🤧" },
  { label: "のどの痛み",                         icon: "😮‍💨" },
  { label: "胃・腸の不調",                       icon: "🫁" },
  { label: "目のかゆみ",                         icon: "👁️" },
  { label: "肩こり・疲れ",                       icon: "💆" },
  { label: "せき・たん",                         icon: "😷" },
  { label: "肌トラブル",                         icon: "🧴" },
  { label: "睡眠・ストレス",                     icon: "😴" },
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
          今の症状{" "}
          <span className="text-xs text-gray-400">（複数選択可）</span>
        </p>
        <div className="grid grid-cols-2 gap-2" data-testid="symptom-grid">
          {SYMPTOMS.map(({ label, icon }) => {
            const selected = selectedSymptoms.includes(label);
            return (
              <button
                key={label}
                onClick={() => toggleSymptom(label)}
                data-testid={`symptom-chip`}
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
          絞り込みオプション{" "}
          <span className="text-xs text-gray-400">（任意）</span>
        </p>
        <div className="flex flex-wrap gap-2" data-testid="filter-chips">
          {FILTERS.map((label) => {
            const selected = selectedFilters.includes(label);
            return (
              <button
                key={label}
                onClick={() => toggleFilter(label)}
                data-testid="filter-chip"
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
