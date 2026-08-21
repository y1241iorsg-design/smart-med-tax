"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  MessageCircle,
  Pill,
  Search,
  Sparkles,
  Store,
  UserRound,
} from "lucide-react";
import {
  getInventory,
  getTaxSummary,
  type InventoryItem,
  type TaxSummary,
} from "@/lib/api";

const THRESHOLD = 12_000;
const YEAR = new Date().getFullYear();

const FEATURE_TILES = [
  {
    href: "/search",
    label: "症状から検索",
    desc: "カテゴリから探す",
    icon: Search,
    bg: "#C8E6C9",
  },
  {
    href: "/handbook",
    label: "OTCお薬手帳",
    desc: "購入履歴の管理",
    icon: BookOpen,
    bg: "#FFF9C4",
  },
  {
    href: "/family",
    label: "家族情報",
    desc: "共有・管理",
    icon: UserRound,
    bg: "#F8BBD0",
  },
  {
    href: "/interaction",
    label: "飲み合わせチェック",
    desc: "成分重複の確認",
    icon: Pill,
    bg: "#FFCCBC",
  },
  {
    href: "/pharmacies",
    label: "店舗検索",
    desc: "近くの薬局",
    icon: Store,
    bg: "#B2DFDB",
  },
  {
    href: "/concierge",
    label: "専門家相談",
    desc: "薬剤師に相談",
    icon: Sparkles,
    bg: "#E1BEE7",
  },
] as const;

export default function HomePage() {
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTaxSummary(YEAR)
      .then(setSummary)
      .catch((e: Error) => setError(e.message));
    getInventory()
      .then((items) => setLowStock(items.filter((i) => i.is_low_stock)))
      .catch(() => {});
  }, []);

  const total = summary?.total_qualified ?? 0;
  const progress = Math.min((total / THRESHOLD) * 100, 100);
  const remaining = Math.max(0, THRESHOLD - total);

  return (
    <div className="animate-fade-in">
      <header className="bg-white px-5 py-3 flex items-center justify-center gap-2.5 border-b border-gray-100">
        <div
          className="inline-flex items-center justify-center w-8 h-8 rounded-xl shrink-0 shadow-sm"
          style={{ background: "linear-gradient(135deg, #FF8A65, #FFAB91)" }}
        >
          <Pill className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-lg font-extrabold tracking-tight">
          <span className="text-gray-900">Smart</span>
          <span
            className="ml-1"
            style={{
              background: "linear-gradient(135deg, #FF8A65, #E57373)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Med-Tax
          </span>
        </h1>
      </header>

      <div className="px-5 space-y-5 pt-5 pb-6">
        {summary?.is_qualified && (
          <div
            className="rounded-2xl p-4 text-sm font-semibold text-gray-800"
            style={{ background: "#C8E6C9" }}
            data-testid="qualified-banner"
          >
            控除対象になりました！申告データを出力できます。
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 rounded-2xl p-3 text-sm">
            {error}
          </div>
        )}

        {lowStock.length > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{ background: "#FFF9C4" }}
            data-testid="low-stock-alert"
          >
            <p className="text-xs font-bold text-amber-800 mb-2">在庫わずか</p>
            {lowStock.map((item) => (
              <p key={item.jan_code} className="text-sm text-amber-900">
                {item.product_name}（残り {item.remaining_doses} 錠）
              </p>
            ))}
          </div>
        )}

        <Link href="/chat" className="block">
          <div
            className="rounded-2xl p-5 flex items-center gap-4 bg-white border-2"
            style={{ borderColor: "#FF8A65" }}
          >
            <div
              className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: "#FFE0D6" }}
            >
              <MessageCircle
                className="w-6 h-6"
                style={{ color: "#FF7043" }}
                strokeWidth={2.25}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900 leading-snug whitespace-nowrap">
                チャット相談でほしい薬を見つける
              </h2>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "#FF8A65" }} />
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          {FEATURE_TILES.map(({ href, label, desc, icon: Icon, bg }) => (
            <Link key={`${href}-${label}`} href={href}>
              <div className="rounded-2xl p-4 h-full" style={{ background: bg }}>
                <Icon className="w-7 h-7 text-gray-700 mb-2.5" strokeWidth={2} />
                <h4 className="text-sm font-bold text-gray-800">{label}</h4>
                <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <Link href="/tax" className="block" data-testid="year-total-link">
          <div className="rounded-2xl p-5" style={{ background: "#FFE0B2" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-600" data-testid="year-label">
                {YEAR}年 セルフメディケーション累計
              </p>
              <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
            </div>
            <p
              className="text-3xl font-bold mb-3 text-gray-900"
              data-testid="total-amount"
            >
              ¥{total.toLocaleString()}
            </p>
            <div className="rounded-full h-2.5 mb-2 overflow-hidden bg-white/70">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: "#FF8A65" }}
                data-testid="progress-bar"
              />
            </div>
            <p className="text-xs text-gray-600">
              控除まであと ¥{remaining.toLocaleString()}（目標: ¥
              {THRESHOLD.toLocaleString()}）
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
