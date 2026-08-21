"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckSquare,
  FileText,
  Loader2,
  Pill,
} from "lucide-react";
import {
  checkInteractions,
  getPurchases,
  type InteractionCheckResult,
  type Purchase,
} from "@/lib/api";

const CURRENT_YEAR = new Date().getFullYear();
const PRIMARY = "#FFCCBC";
const PRIMARY_SOFT = "#FFF3E0";

export default function InteractionPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedJanCodes, setSelectedJanCodes] = useState<string[]>([]);
  const [result, setResult] = useState<InteractionCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPurchases() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPurchases(CURRENT_YEAR);
        if (active) setPurchases(data);
      } catch (caught: unknown) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "購入履歴の取得に失敗しました",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPurchases();
    return () => {
      active = false;
    };
  }, []);

  const products = useMemo(
    () =>
      Array.from(
        new Map(
          purchases.map((purchase) => [purchase.jan_code, purchase]),
        ).values(),
      ),
    [purchases],
  );

  function toggleProduct(janCode: string) {
    setSelectedJanCodes((current) =>
      current.includes(janCode)
        ? current.filter((code) => code !== janCode)
        : [...current, janCode],
    );
    setResult(null);
    setError(null);
  }

  async function handleRun() {
    if (selectedJanCodes.length < 2) return;

    setRunning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await checkInteractions(selectedJanCodes));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "飲み合わせ情報の取得に失敗しました",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="bg-white px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: PRIMARY_SOFT }}
          >
            <Pill className="h-5 w-5" style={{ color: PRIMARY }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              飲み合わせ・成分重複
            </h1>
            <p className="text-[11px] text-gray-500">
              {CURRENT_YEAR}年の購入記録から確認
            </p>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-5 py-4 pb-24">
        <section
          className="rounded-2xl p-4"
          style={{ background: PRIMARY_SOFT }}
        >
          <div className="mb-3 flex items-start gap-2">
            <CheckSquare
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: PRIMARY }}
            />
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                商品を2件以上選んでください
              </h2>
              <p className="mt-0.5 text-xs text-gray-600">
                同じJANコードの商品は1件にまとめて表示しています
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2
                className="h-6 w-6 animate-spin"
                style={{ color: PRIMARY }}
              />
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl bg-white p-4 text-center">
              <p className="text-sm text-gray-600">
                {CURRENT_YEAR}年の購入記録がありません
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((product) => {
                const checked = selectedJanCodes.includes(product.jan_code);
                return (
                  <label
                    key={product.jan_code}
                    className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(product.jan_code)}
                      className="h-5 w-5 shrink-0 accent-[#FFCCBC]"
                      data-testid="interaction-product-check"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-gray-800">
                        {product.product_name}
                      </span>
                      <span className="block text-[11px] text-gray-500">
                        JAN {product.jan_code}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {error && (
          <div className="flex gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleRun}
          disabled={selectedJanCodes.length < 2 || running}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-gray-900 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: PRIMARY }}
          data-testid="interaction-run"
        >
          {running && <Loader2 className="h-4 w-4 animate-spin" />}
          {running ? "情報を取得しています" : "注意情報を確認する"}
        </button>

        {result && (
          <section className="space-y-4" data-testid="interaction-result">
            <div
              className="rounded-2xl p-4"
              style={{ background: PRIMARY_SOFT }}
            >
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: PRIMARY }} />
                <h2 className="text-sm font-bold text-gray-800">
                  ご確認ください
                </h2>
              </div>
              <p className="text-xs leading-5 text-gray-700">
                {result.disclaimer}
              </p>
            </div>

            <div
              className="rounded-2xl p-4"
              style={{ background: PRIMARY_SOFT }}
            >
              <h2 className="mb-3 text-sm font-bold text-gray-800">
                成分の重複情報
              </h2>
              {result.overlaps.length === 0 ? (
                <p className="rounded-xl bg-white p-3 text-xs text-gray-600">
                  成分重複の記載はありません
                </p>
              ) : (
                <ul className="space-y-2">
                  {result.overlaps.map((overlap) => (
                    <li
                      key={`${overlap.ingredient}-${overlap.product_names.join("-")}`}
                      className="rounded-xl bg-white p-3"
                    >
                      <p className="text-sm font-bold text-gray-800">
                        {overlap.ingredient}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-600">
                        {overlap.product_names.join("・")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              className="rounded-2xl p-4"
              style={{ background: PRIMARY_SOFT }}
            >
              <h2 className="mb-3 text-sm font-bold text-gray-800">
                使用上の注意
              </h2>
              {result.precaution_notes.length === 0 ? (
                <p className="rounded-xl bg-white p-3 text-xs text-gray-600">
                  注意事項の記載はありません
                </p>
              ) : (
                <ul className="space-y-2">
                  {result.precaution_notes.map((note, index) => (
                    <li
                      key={`${note.product_name}-${index}`}
                      className="rounded-xl bg-white p-3"
                    >
                      <p className="text-sm font-bold text-gray-800">
                        {note.product_name}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-gray-700">
                        {note.precautions}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
