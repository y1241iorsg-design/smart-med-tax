"use client";
import { useState } from "react";
import {
  findProductsByName,
  lookupJan,
  addPurchase,
  type Product,
} from "@/lib/api";
import BarcodeScanner from "@/components/BarcodeScanner";

const today = () => new Date().toISOString().split("T")[0];

type Mode = "name" | "jan";

const PASTEL_CARDS = ["#FFF3E0", "#E3F2FD", "#E8F5E9", "#FCE4EC", "#F3E5F5"];

export default function ScanPage() {
  const [mode, setMode] = useState<Mode>("name");
  const [janCode, setJanCode] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [nameResults, setNameResults] = useState<Product[]>([]);
  const [nameSearched, setNameSearched] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [price, setPrice] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(today());
  const [storeName, setStoreName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  function selectProduct(p: Product) {
    setProduct(p);
    setJanCode(p.jan_code);
    setPrice(p.price > 0 ? String(p.price) : "");
    setError(null);
    setSuccess(false);
    setNameResults([]);
    setNameSearched(false);
  }

  async function handleJanLookup() {
    const code = janCode.trim();
    if (!code) return;
    setError(null);
    setProduct(null);
    setSuccess(false);
    try {
      selectProduct(await lookupJan(code));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "検索に失敗しました");
    }
  }

  async function handleNameSearch() {
    const q = nameQuery.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setProduct(null);
    setSuccess(false);
    setNameSearched(true);
    try {
      setNameResults(await findProductsByName(q));
    } catch (e: unknown) {
      setNameResults([]);
      setError(e instanceof Error ? e.message : "商品名検索に失敗しました");
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd() {
    if (!product || !price) return;
    setLoading(true);
    setError(null);
    try {
      await addPurchase({
        jan_code: product.jan_code,
        price: parseInt(price, 10),
        quantity: 1,
        purchased_at: purchasedAt,
        store_name: storeName || undefined,
        purpose: purpose || undefined,
        memo: memo || undefined,
      });
      setSuccess(true);
      setJanCode("");
      setNameQuery("");
      setNameResults([]);
      setNameSearched(false);
      setProduct(null);
      setPrice("");
      setStoreName("");
      setPurpose("");
      setMemo("");
      setPurchasedAt(today());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in px-5 py-6">
      <header className="mb-5">
        <h1 className="text-lg font-bold text-gray-800">購入記録を追加</h1>
        <p className="text-[11px] text-gray-500 mt-0.5">
          商品名検索、またはJANコードでお薬を登録
        </p>
      </header>

      {success && (
        <div
          className="rounded-2xl p-3 mb-4 text-sm font-medium text-gray-800"
          style={{ background: "#C8E6C9" }}
          data-testid="success-message"
        >
          薬箱に追加しました
        </div>
      )}

      {error && (
        <div
          className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm"
          data-testid="error-message"
        >
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-4" data-testid="lookup-mode-tabs">
        {(
          [
            { id: "name" as const, label: "商品名で探す", bg: "#B3E5FC" },
            { id: "jan" as const, label: "JANコード", bg: "#FFE0B2" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setMode(tab.id);
              setError(null);
              setSuccess(false);
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              mode === tab.id ? "text-gray-900" : "text-gray-500 bg-white border border-gray-100"
            }`}
            style={mode === tab.id ? { background: tab.bg } : undefined}
            data-testid={`mode-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "name" ? (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "#B3E5FC" }}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            商品名・成分名
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleNameSearch()}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#81D4FA] bg-white"
              placeholder="例: A解熱鎮痛薬、イブ、胃腸"
              data-testid="name-input"
            />
            <button
              type="button"
              onClick={() => void handleNameSearch()}
              disabled={searching || !nameQuery.trim()}
              className="text-gray-900 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
              style={{ background: "#FFE0B2" }}
              data-testid="name-search-button"
            >
              {searching ? "…" : "検索"}
            </button>
          </div>

          {nameSearched && !product && (
            <div className="mt-3 space-y-2" data-testid="name-results">
              {nameResults.length === 0 ? (
                <p className="text-sm text-gray-600 bg-white/70 rounded-xl px-3 py-3">
                  該当する商品がありません。別のキーワードでお試しください。
                </p>
              ) : (
                nameResults.map((p, i) => (
                  <button
                    key={p.jan_code}
                    type="button"
                    onClick={() => selectProduct(p)}
                    className="w-full text-left rounded-xl p-3 transition-transform active:scale-[0.99]"
                    style={{ background: PASTEL_CARDS[i % PASTEL_CARDS.length] }}
                    data-testid="name-result-item"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{p.generic_name}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{p.category}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {p.is_qualified ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/80 text-green-700">
                            税制対象
                          </span>
                        ) : null}
                        <p className="text-xs font-semibold text-gray-700 mt-1">
                          参考 ¥{p.price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <BarcodeScanner
            onScan={(code) => {
              setJanCode(code);
              setError(null);
              setProduct(null);
              setSuccess(false);
              lookupJan(code)
                .then(selectProduct)
                .catch((e: unknown) =>
                  setError(e instanceof Error ? e.message : "検索に失敗しました"),
                );
            }}
            onError={setError}
          />

          <div className="rounded-2xl p-4 mb-4" style={{ background: "#FFE0B2" }}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              JANコード（13桁）
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={janCode}
                onChange={(e) => setJanCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleJanLookup()}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCCBC] bg-white"
                placeholder="例: 4987117709559"
                data-testid="jan-input"
              />
              <button
                type="button"
                onClick={() => void handleJanLookup()}
                className="text-gray-900 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "#FFCCBC" }}
                data-testid="lookup-button"
              >
                検索
              </button>
            </div>
          </div>
        </>
      )}

      {product && (
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: "#FFF9C4" }}
          data-testid="product-info"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 mr-3">
              <h2 className="font-bold text-base" data-testid="product-name">
                {product.name}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{product.generic_name}</p>
              <p className="text-xs text-gray-400 mt-1">{product.efficacy}</p>
              <p className="text-[11px] text-gray-400 mt-1">JAN: {product.jan_code}</p>
            </div>
            {product.is_qualified ? (
              <span
                className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap"
                data-testid="qualified-badge"
              >
                ✓ 税制対象
              </span>
            ) : (
              <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                対象外
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setProduct(null);
              setPrice("");
            }}
            className="text-xs text-gray-500 underline mb-3"
          >
            選び直す
          </button>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">購入金額（円）</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCCBC] bg-white"
                placeholder="980"
                data-testid="price-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">購入日</label>
              <input
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCCBC] bg-white"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">店舗名（任意）</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCCBC] bg-white"
              placeholder="マツキヨ渋谷店"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">使用目的（任意）</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="例: 頭痛のため"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCCBC] bg-white"
              data-testid="purpose-input"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">メモ（任意）</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCCBC] bg-white"
              data-testid="memo-input"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!price || loading}
            className="w-full text-gray-900 py-3 rounded-xl font-semibold disabled:opacity-50"
            style={{ background: "#FFCCBC" }}
            data-testid="add-button"
          >
            {loading ? "追加中..." : "薬箱に追加する"}
          </button>
        </div>
      )}
    </div>
  );
}
