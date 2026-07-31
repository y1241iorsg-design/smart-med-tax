"use client";
import { useState } from "react";
import { lookupJan, addPurchase, type Product } from "@/lib/api";
import BarcodeScanner from "@/components/BarcodeScanner";

const today = () => new Date().toISOString().split("T")[0];

export default function ScanPage() {
  const [janCode, setJanCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [price, setPrice] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(today());
  const [storeName, setStoreName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLookup() {
    const code = janCode.trim();
    if (!code) return;
    setError(null);
    setProduct(null);
    setSuccess(false);
    try {
      setProduct(await lookupJan(code));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "検索に失敗しました");
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
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">JANスキャン</h1>

      {success && (
        <div
          className="bg-green-100 text-green-800 rounded-xl p-3 mb-4 text-sm font-medium"
          data-testid="success-message"
        >
          ✓ 薬箱に追加しました
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

      <BarcodeScanner
        onScan={(code) => {
          setJanCode(code);
          setError(null);
          setProduct(null);
          setSuccess(false);
          lookupJan(code)
            .then(setProduct)
            .catch((e: unknown) =>
              setError(e instanceof Error ? e.message : "検索に失敗しました")
            );
        }}
        onError={setError}
      />

      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          JANコード（13桁）
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={janCode}
            onChange={(e) => setJanCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="例: 4987117709559"
            data-testid="jan-input"
          />
          <button
            onClick={handleLookup}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium active:bg-indigo-700"
            data-testid="lookup-button"
          >
            検索
          </button>
        </div>
      </div>

      {product && (
        <div
          className="bg-white rounded-xl shadow p-6 mb-4"
          data-testid="product-info"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 mr-3">
              <h2 className="font-bold text-base" data-testid="product-name">
                {product.name}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{product.generic_name}</p>
              <p className="text-xs text-gray-400 mt-1">{product.efficacy}</p>
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

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                購入金額（円）
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">
              店舗名（任意）
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="マツキヨ渋谷店"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">
              使用目的（任意）
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="例: 頭痛のため"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              data-testid="purpose-input"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">
              メモ（任意）
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              data-testid="memo-input"
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={!price || loading}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 active:bg-green-700"
            data-testid="add-button"
          >
            {loading ? "追加中..." : "薬箱に追加する"}
          </button>
        </div>
      )}
    </main>
  );
}
