"use client";
import { useEffect, useState } from "react";
import { getTaxSummary, getTaxExportUrl, type TaxSummary } from "@/lib/api";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function TaxPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    getTaxSummary(year)
      .then(setSummary)
      .catch((e: Error) => setError(e.message));
  }, [year]);

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">税制レポート</h1>

      <div className="mb-4">
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
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {summary && (
        <>
          {summary.is_qualified && (
            <div
              className="bg-green-100 text-green-800 rounded-xl p-4 mb-4 font-semibold text-sm"
              data-testid="qualified-banner"
            >
              🎉 控除対象です！{year}年の申告データを出力してください。
            </div>
          )}

          <div className="bg-white rounded-xl shadow p-6 mb-4">
            <h2 className="text-xs text-gray-500 mb-4">
              {year}年 セルフメディケーション税制
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">対象品目購入額</p>
                <p
                  className="text-2xl font-bold text-red-600"
                  data-testid="total-qualified"
                >
                  ¥{summary.total_qualified.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">控除可能額</p>
                <p
                  className="text-2xl font-bold text-indigo-600"
                  data-testid="deductible-amount"
                >
                  {summary.deductible_amount > 0
                    ? `¥${summary.deductible_amount.toLocaleString()}`
                    : "—"}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">
              ※ ¥{summary.threshold.toLocaleString()}超で（合計額 − ¥
              {summary.threshold.toLocaleString()}）が控除対象
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={getTaxExportUrl(year, "csv")}
              className="bg-red-600 text-white rounded-xl p-4 text-center font-semibold text-sm active:bg-red-700"
              data-testid="csv-download"
            >
              📄 CSV出力
            </a>
            <a
              href={getTaxExportUrl(year, "xml")}
              className="bg-violet-600 text-white rounded-xl p-4 text-center font-semibold text-sm active:bg-violet-700"
              data-testid="xml-download"
            >
              🗂 XML出力
            </a>
          </div>
        </>
      )}
    </main>
  );
}
