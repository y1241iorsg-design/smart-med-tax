"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getTaxSummary, type TaxSummary } from "@/lib/api";

const THRESHOLD = 12_000;
const YEAR = new Date().getFullYear();

export default function HomePage() {
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTaxSummary(YEAR)
      .then(setSummary)
      .catch((e: Error) => setError(e.message));
  }, []);

  const total = summary?.total_qualified ?? 0;
  const progress = Math.min((total / THRESHOLD) * 100, 100);
  const remaining = Math.max(0, THRESHOLD - total);

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Smart Med-Tax</h1>

      {summary?.is_qualified && (
        <div
          className="bg-green-100 text-green-800 rounded-xl p-4 mb-4 font-semibold text-sm"
          data-testid="qualified-banner"
        >
          🎉 控除対象になりました！申告データを出力できます。
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1" data-testid="year-label">
          {YEAR}年 セルフメディケーション累計
        </p>
        <p
          className="text-4xl font-bold text-indigo-600 mb-3"
          data-testid="total-amount"
        >
          ¥{total.toLocaleString()}
        </p>
        <div className="bg-gray-200 rounded-full h-3 mb-2">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
            data-testid="progress-bar"
          />
        </div>
        <p className="text-xs text-gray-500">
          控除まであと ¥{remaining.toLocaleString()}（目標: ¥
          {THRESHOLD.toLocaleString()}）
        </p>
      </div>

      <Link
        href="/scan"
        className="block w-full bg-indigo-600 text-white text-center py-4 rounded-xl font-semibold text-lg mb-4 active:bg-indigo-700"
        data-testid="scan-link"
      >
        📷 JANコードを読み取る
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/history"
          className="bg-white rounded-xl shadow p-4 text-center text-sm font-medium text-gray-700"
        >
          📋 購入履歴
        </Link>
        <Link
          href="/tax"
          className="bg-white rounded-xl shadow p-4 text-center text-sm font-medium text-gray-700"
        >
          📊 税制レポート
        </Link>
      </div>
    </main>
  );
}
