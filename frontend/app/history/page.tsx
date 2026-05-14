"use client";
import { useEffect, useState } from "react";
import { getPurchases, type Purchase } from "@/lib/api";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function HistoryPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [qualifiedOnly, setQualifiedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    getPurchases(year)
      .then(setPurchases)
      .catch((e: Error) => setError(e.message));
  }, [year]);

  const displayed = qualifiedOnly
    ? purchases.filter((p) => p.is_qualified)
    : purchases;

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">購入履歴</h1>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          data-testid="year-select"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={qualifiedOnly}
            onChange={(e) => setQualifiedOnly(e.target.checked)}
            className="rounded"
          />
          税制対象品目のみ
        </label>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {displayed.length === 0 ? (
        <p className="text-gray-400 text-center py-16 text-sm">
          購入記録がありません
        </p>
      ) : (
        <div
          className="bg-white rounded-xl shadow overflow-hidden"
          data-testid="purchase-list"
        >
          {displayed.map((p, i) => (
            <div
              key={p.id}
              className={`flex justify-between items-center px-4 py-3 ${
                i < displayed.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <div>
                <p className="font-medium text-sm">{p.product_name}</p>
                <p className="text-xs text-gray-400">
                  {p.purchased_at}
                  {p.store_name ? ` · ${p.store_name}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-amber-600 text-sm">
                  ¥{p.price.toLocaleString()}
                </p>
                {p.is_qualified ? (
                  <span className="text-xs text-green-600">税制対象</span>
                ) : (
                  <span className="text-xs text-gray-400">対象外</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
