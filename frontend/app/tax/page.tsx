"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { getTaxSummary, downloadTaxExport, type TaxSummary } from "@/lib/api";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function TaxPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      getTaxSummary(year)
        .then((data) => {
          if (!cancelled) {
            setSummary(data);
            setError(null);
          }
        })
        .catch((caught: unknown) => {
          if (!cancelled) {
            setError(
              caught instanceof Error ? caught.message : "取得に失敗しました",
            );
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [year]);

  return (
    <div className="animate-fade-in">
      <header className="px-5 pt-6 pb-4 bg-white">
        <h1 className="text-lg font-bold text-gray-800">税制支援</h1>
        <p className="text-[11px] text-gray-500">
          確定申告の準備を楽にする便利機能
        </p>

        <div className="flex gap-1.5 mt-4">
          {YEAR_OPTIONS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                year === y ? "text-gray-900" : "text-gray-600"
              }`}
              style={
                year === y ? { background: "#FFCCBC" } : { background: "#B2DFDB" }
              }
              data-testid={y === year ? "year-select" : undefined}
            >
              {y}年
            </button>
          ))}
        </div>
      </header>

      <div className="px-5 py-4">
        {error && (
          <div className="bg-red-50 text-red-700 rounded-2xl p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {summary && (
          <>
            {summary.is_qualified && (
              <div
                className="rounded-2xl p-4 mb-4 font-semibold text-sm text-gray-800"
                style={{ background: "#C8E6C9" }}
                data-testid="qualified-banner"
              >
                控除対象です！{year}年の申告データを出力してください。
              </div>
            )}

            <div
              className="rounded-2xl p-5 mb-4"
              style={{ background: "#FFF3E0" }}
            >
              <h2 className="text-xs text-gray-500 mb-4">
                {year}年 セルフメディケーション税制（家族合算）
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">対象品目購入額</p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: "#FFE0B2" }}
                    data-testid="total-qualified"
                  >
                    ¥{summary.total_qualified.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">控除可能額</p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: "#FFCCBC" }}
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
                {summary.cap_applied && (
                  <span className="block mt-1 text-amber-700">
                    ※ 控除上限 ¥{summary.deduction_cap.toLocaleString()} を適用
                  </span>
                )}
              </p>

              {summary.by_member && summary.by_member.length > 0 && (
                <div className="mt-4 border-t border-[#FFE0B2] pt-3" data-testid="tax-by-member">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    家族別の対象購入額
                  </p>
                  <ul className="space-y-1">
                    {summary.by_member.map((member) => (
                      <li
                        key={member.name}
                        className="flex justify-between text-xs text-gray-700"
                      >
                        <span>{member.name}</span>
                        <span>¥{member.total_qualified.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <section
              className="rounded-2xl p-4 mb-4"
              style={{ background: "#E3F2FD" }}
              data-testid="tax-guidance"
            >
              <h2 className="text-sm font-bold text-gray-800 mb-3">
                申告の種類について
              </h2>

              <div className="space-y-2.5 mb-3">
                <div className="flex items-start gap-2.5 rounded-xl bg-white/70 p-3">
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-gray-800"
                    style={{ background: "#FFCCBC" }}
                  >
                    国税
                  </span>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    <span className="font-semibold">所得税の確定申告</span>
                    <br />
                    所定の集計フォーマットはページ下部からダウンロードできます。
                  </p>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl bg-white/70 p-3">
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-gray-800"
                    style={{ background: "#B2DFDB" }}
                  >
                    住民税
                  </span>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    <span className="font-semibold">特別区民税・都民税の申告</span>
                    <br />
                    自治体ごとに様式・案内が異なります。
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-gray-600 leading-relaxed">
                このアプリで案内するのは<strong>確定申告向けの集計フォーマット</strong>のみです。
                区民税・都民税の手続きは、お住まいの自治体の案内をご確認ください。
              </p>
            </section>

            <div className="mb-2">
              <h2 className="text-sm font-bold text-gray-800 mb-1">
                確定申告フォーマットのダウンロード
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                医療費集計フォーム入力の参考用です（e-Taxへの直接連携はありません）。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => downloadTaxExport(year, "csv")}
                className="rounded-2xl p-4 text-center font-semibold text-sm text-gray-900 flex flex-col items-center gap-2"
                style={{ background: "#FFCCBC" }}
                data-testid="csv-download"
              >
                <Download className="w-5 h-5" />
                CSV出力
              </button>
              <button
                type="button"
                onClick={() => downloadTaxExport(year, "xml")}
                className="rounded-2xl p-4 text-center font-semibold text-sm text-gray-900 flex flex-col items-center gap-2"
                style={{ background: "#FFE0B2" }}
                data-testid="xml-download"
              >
                <Download className="w-5 h-5" />
                XML出力
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
