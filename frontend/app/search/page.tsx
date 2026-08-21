"use client";
import { useState, useEffect, Suspense, startTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pill } from "lucide-react";
import {
  getFamily,
  searchProducts,
  type ProductSearchResult,
} from "@/lib/api";

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

const AGE_BANDS = ["指定なし", "〜20代", "30代", "40代", "50代以上"] as const;
const SEX_OPTIONS = ["指定なし", "女性", "男性"] as const;

function seasonHint(): string | null {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "春（花粉・気温差の時期）";
  if (month >= 6 && month <= 8) return "夏（熱中症・冷房冷えに注意）";
  if (month >= 9 && month <= 11) return "秋（乾燥・花粉の時期）";
  return "冬（かぜ・インフルエンザの時期）";
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [currentMeds, setCurrentMeds] = useState<string[]>([]);
  const [medsInput, setMedsInput] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [ageBand, setAgeBand] = useState<(typeof AGE_BANDS)[number]>("指定なし");
  const [sex, setSex] = useState<(typeof SEX_OPTIONS)[number]>("指定なし");
  const [results, setResults] = useState<ProductSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromChat = searchParams.get("symptoms");
    const medsParam = searchParams.get("meds");
    const initialMeds = medsParam
      ? decodeURIComponent(medsParam).split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    void getFamily()
      .then((members) => {
        const self = members.find((m) => m.name === "自分");
        const fromFamily = self?.current_medications ?? [];
        const fromConditions = self?.conditions ?? [];
        const merged = Array.from(new Set([...initialMeds, ...fromFamily]));
        startTransition(() => {
          setCurrentMeds(merged);
          setMedsInput(merged.join("、"));
          setConditions(fromConditions);
        });
      })
      .catch(() => {
        if (initialMeds.length > 0) {
          startTransition(() => {
            setCurrentMeds(initialMeds);
            setMedsInput(initialMeds.join("、"));
          });
        }
      });

    if (fromChat) {
      const symptoms = decodeURIComponent(fromChat).split(",").filter(Boolean);
      if (symptoms.length > 0) {
        startTransition(() => {
          setSelectedSymptoms(symptoms);
        });
        void runSearch(symptoms, [], initialMeds, []);
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

  function applyMedsInput() {
    const parsed = medsInput
      .split(/[、,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setCurrentMeds(parsed);
    return parsed;
  }

  function filtersWithProfile(base: string[]): string[] {
    const next = [...base];
    // 属性は推奨スコアに使わず、任意フィルタの候補としてのみ反映
    if (
      (ageBand === "40代" || ageBand === "50代以上") &&
      !next.includes("更年期・ホルモンケア向け")
    ) {
      // 自動ONはせず、UI上で提案表示のみ。ここではそのまま返す
    }
    return next;
  }

  async function runSearch(
    symptoms: string[],
    filters: string[],
    meds: string[] = currentMeds,
    conditionList: string[] = conditions
  ) {
    if (symptoms.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      setResults(
        await searchProducts(
          symptoms,
          filtersWithProfile(filters),
          meds,
          conditionList
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  function handleSearchClick() {
    const meds = applyMedsInput();
    let filters = [...selectedFilters];
    if (
      (ageBand === "40代" || ageBand === "50代以上") &&
      !filters.includes("更年期・ホルモンケア向け")
    ) {
      // 任意: チェック済みなら既にある。未選択なら追加しない（提案チップでユーザーが選ぶ）
    }
    void runSearch(selectedSymptoms, filters, meds, conditions);
  }

  const season = seasonHint();
  const suggestMenopause =
    ageBand === "40代" || ageBand === "50代以上";

  return (
    <div className="animate-fade-in px-5 py-6">
      <header className="mb-5">
        <h1 className="text-lg font-bold text-gray-800">お薬を検索</h1>
        <p className="text-[11px] text-gray-500 mt-0.5">
          症状を選ぶとOTC医薬品を価格順に一覧表示します（推奨順ではありません）。
        </p>
      </header>

      <div className="rounded-2xl p-4 mb-4" style={{ background: "#B3E5FC" }}>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          今の症状を選んでください
          <span className="text-xs font-normal text-gray-500">（複数選択可）</span>
        </p>
        <div className="grid grid-cols-2 gap-2" data-testid="symptom-grid">
          {SYMPTOMS.map(({ label, icon }) => {
            const selected = selectedSymptoms.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleSymptom(label)}
                data-testid="symptom-chip"
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                  selected
                    ? "font-semibold text-gray-900"
                    : "bg-white/80 text-gray-700"
                }`}
                style={selected ? { background: "#FFE0B2" } : undefined}
              >
                <span className="text-lg leading-none shrink-0">{icon}</span>
                <span className="leading-tight text-xs">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl p-4 mb-4" style={{ background: "#FFF3E0" }} data-testid="profile-panel">
        <p className="text-sm font-semibold text-gray-700 mb-1">検索の参考情報（任意）</p>
        <p className="text-[11px] text-gray-500 mb-3">
          診断には使いません。成分重複の注意表示や絞り込みの参考にします。
          {season ? ` いまの季節の目安: ${season}` : ""}
        </p>

        <p className="text-xs text-gray-600 mb-1.5">年齢帯</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {AGE_BANDS.map((band) => (
            <button
              key={band}
              type="button"
              onClick={() => setAgeBand(band)}
              className={`text-xs px-2.5 py-1 rounded-full ${
                ageBand === band ? "font-semibold text-gray-900" : "text-gray-600 bg-white/70"
              }`}
              style={ageBand === band ? { background: "#FFCCBC" } : undefined}
              data-testid="age-chip"
            >
              {band}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-600 mb-1.5">性別</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {SEX_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSex(option)}
              className={`text-xs px-2.5 py-1 rounded-full ${
                sex === option ? "font-semibold text-gray-900" : "text-gray-600 bg-white/70"
              }`}
              style={sex === option ? { background: "#F8BBD0" } : undefined}
              data-testid="sex-chip"
            >
              {option}
            </button>
          ))}
        </div>

        <label className="block text-xs text-gray-600 mb-1">服用中の薬（家族情報から自動入力可）</label>
        <input
          type="text"
          value={medsInput}
          onChange={(e) => setMedsInput(e.target.value)}
          placeholder="例: A解熱鎮痛薬、I胃腸薬"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          data-testid="current-meds-input"
        />

        {conditions.length > 0 && (
          <p className="mt-3 text-[11px] text-gray-600" data-testid="conditions-hint">
            登録持病の参考表示: {conditions.join("、")}
            （添付文書の注意事項と照合します。診断ではありません）
          </p>
        )}

        {suggestMenopause && !selectedFilters.includes("更年期・ホルモンケア向け") && (
          <button
            type="button"
            onClick={() => toggleFilter("更年期・ホルモンケア向け")}
            className="mt-3 text-xs px-3 py-1.5 rounded-full text-gray-800"
            style={{ background: "#E1BEE7" }}
            data-testid="menopause-suggest"
          >
            年齢帯に合わせて「更年期・ホルモンケア向け」を追加（任意）
          </button>
        )}
      </div>

      <div className="rounded-2xl p-4 mb-4" style={{ background: "#DCEDC8" }}>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          絞り込みオプション
          <span className="text-xs font-normal text-gray-500">（任意）</span>
        </p>
        <div className="flex flex-wrap gap-2" data-testid="filter-chips">
          {FILTERS.map((label) => {
            const selected = selectedFilters.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleFilter(label)}
                data-testid="filter-chip"
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  selected ? "text-gray-900" : "text-gray-600 bg-white/70"
                }`}
                style={selected ? { background: "#F8BBD0" } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSearchClick}
        disabled={selectedSymptoms.length === 0 || loading}
        data-testid="search-button"
        className="w-full text-gray-900 py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40"
        style={{ background: "#FFCCBC" }}
      >
        {loading ? "検索中..." : "探す"}
      </button>

      {error && (
        <div
          className="bg-red-50 text-red-700 rounded-2xl p-3 mt-4 text-sm"
          data-testid="error-message"
        >
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-3 mt-5" data-testid="result-grid">
          {results.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              該当する商品が見つかりませんでした。薬剤師または登録販売者にご相談ください。
            </p>
          ) : (
            results.map((p, idx) => (
              <div
                key={p.jan_code}
                className="rounded-2xl p-4"
                style={{
                  background: ["#FFF3E0", "#FCE4EC", "#E8F5E9", "#E3F2FD", "#F3E5F5"][
                    idx % 5
                  ],
                }}
                data-testid="product-card"
              >
                <div className="flex gap-3 mb-2">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-white/70"
                    data-testid="product-image-placeholder"
                    aria-hidden
                  >
                    <Pill className="w-7 h-7 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-gray-800">{p.name}</h3>
                      {p.is_qualified ? (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap font-medium text-gray-800"
                          style={{ background: "#FFF9C4" }}
                        >
                          税制対象
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{p.category}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{p.efficacy}</p>
                  </div>
                </div>
                {p.overlap_warning && (
                  <p
                    className="text-xs text-amber-800 rounded-lg px-2 py-1 mb-2 bg-white/50"
                    data-testid="overlap-warning"
                  >
                    服用中の薬と成分が重複する可能性があります。薬剤師にご相談ください。
                  </p>
                )}
                {p.condition_warnings && p.condition_warnings.length > 0 && (
                  <p
                    className="text-xs text-amber-900 rounded-lg px-2 py-1 mb-2 bg-white/50"
                    data-testid="condition-warning"
                  >
                    登録の持病（{p.condition_warnings.join("、")}）に関連する注意が添付文書にあります。専門家にご確認ください。
                  </p>
                )}
                <p className="font-semibold text-gray-800 text-sm mb-1">
                  <span className="text-xs font-normal text-gray-500 mr-1">最安参考</span>
                  ¥{p.price.toLocaleString()}
                  {p.vendor_max_price != null && p.vendor_max_price !== p.price ? (
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      〜 ¥{p.vendor_max_price.toLocaleString()}
                    </span>
                  ) : null}
                </p>
                <p className="text-[10px] text-gray-400 mb-3">
                  {p.vendor_count
                    ? `${p.vendor_count}店舗の参考価格（最新は購入ページで確認）`
                    : "参考価格"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/products/${p.jan_code}`}
                    className="block text-center text-gray-900 py-2 rounded-xl text-sm font-medium"
                    style={{ background: "#B3E5FC" }}
                    data-testid="product-detail-link"
                  >
                    詳細・購入
                  </Link>
                  <Link
                    href={`/products/${p.jan_code}#handbook`}
                    className="block text-center text-gray-900 py-2 rounded-xl text-sm font-medium"
                    style={{ background: "#FFCCBC" }}
                    data-testid="handbook-register-link"
                  >
                    お薬手帳に登録
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-400 leading-relaxed mt-6 mb-2">
        本一覧は添付文書の効能・効果に基づく参考情報であり、特定の商品を推奨するものではありません。
        {sex !== "指定なし" || ageBand !== "指定なし"
          ? `（参考入力: ${[ageBand !== "指定なし" ? ageBand : null, sex !== "指定なし" ? sex : null].filter(Boolean).join(" / ")}）`
          : ""}
      </p>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}
