"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  lookupJan,
  getProductVendors,
  addPurchase,
  type Product,
  type VendorListing,
} from "@/lib/api";

const today = () => new Date().toISOString().split("T")[0];

export default function ProductDetailPage() {
  const params = useParams<{ jan_code: string }>();
  const janCode = params.jan_code;

  const [product, setProduct] = useState<Product | null>(null);
  const [vendors, setVendors] = useState<VendorListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [price, setPrice] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(today());
  const [storeName, setStoreName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, v] = await Promise.all([lookupJan(janCode), getProductVendors(janCode)]);
      setProduct(p);
      setVendors(v);
      if (v.length > 0) {
        setPrice(String(v[0].price));
        setStoreName(v[0].store_name);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "商品情報の取得に失敗しました");
    }
  }, [janCode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRegister() {
    if (!product || !price) return;
    setSubmitting(true);
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !product) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8 pb-24">
        <div className="bg-red-100 text-red-700 rounded-xl p-4 text-sm" data-testid="error-message">
          {error}
        </div>
      </main>
    );
  }

  if (!product) {
    return <main className="max-w-2xl mx-auto px-6 py-8 pb-24 text-gray-400 text-sm">読み込み中...</main>;
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-8 pb-24" data-testid="product-detail">
      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
          {product.is_qualified ? (
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">
              ✓ 税制対象
            </span>
          ) : null}
        </div>
        <p className="text-sm text-gray-500 mb-4">{product.generic_name}</p>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-semibold text-gray-700">効能・効果</dt>
            <dd className="text-gray-600">{product.efficacy}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-700">用法・用量</dt>
            <dd className="text-gray-600">{product.dosage}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-700">副作用</dt>
            <dd className="text-gray-600">{product.side_effects}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-700">してはいけないこと・相談すること</dt>
            <dd className="text-gray-600">{product.precautions}</dd>
          </div>
        </dl>

        {product.pdf_url && (
          <a
            href={product.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="pdf-link"
            className="inline-block mt-4 text-indigo-600 text-sm font-medium underline"
          >
            添付文書(公式情報)を見る ↗
          </a>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <h2 className="font-bold text-sm text-gray-900 mb-3">購入先(複数店舗)</h2>
        <div className="space-y-2" data-testid="vendor-list">
          {vendors.map((v, i) => (
            <div key={i} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium">{v.store_name}</p>
                <p className="text-xs text-gray-400">{v.in_stock ? "在庫あり" : "在庫切れ"}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-amber-600">¥{v.price.toLocaleString()}</p>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg"
                  data-testid="vendor-purchase-link"
                >
                  購入ページへ
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-bold text-sm text-gray-900 mb-3">お薬手帳に登録</h2>

        {success && (
          <div className="bg-green-100 text-green-800 rounded-xl p-3 mb-4 text-sm font-medium" data-testid="success-message">
            ✓ お薬手帳に登録しました
          </div>
        )}
        {error && (
          <div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm" data-testid="error-message">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">購入金額（円）</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              data-testid="price-input"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">購入日</label>
            <input
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">店舗名</label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">使用目的（任意）</label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="例: 頭痛のため"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            data-testid="purpose-input"
          />
        </div>
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">メモ（任意）</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            data-testid="memo-input"
          />
        </div>
        <button
          onClick={handleRegister}
          disabled={!price || submitting}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          data-testid="register-button"
        >
          {submitting ? "登録中..." : "お薬手帳に登録する"}
        </button>
      </div>
    </main>
  );
}
