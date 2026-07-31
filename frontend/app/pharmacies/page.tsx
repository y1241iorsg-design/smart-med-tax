"use client";
import { useState } from "react";
import { getNearbyPharmacies, type Pharmacy } from "@/lib/api";

export default function PharmaciesPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchNearby() {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("位置情報が利用できません");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setPharmacies(await getNearbyPharmacies(pos.coords.latitude, pos.coords.longitude));
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : "検索に失敗しました");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("位置情報の取得が拒否されました。ブラウザの設定を確認してください。");
        setLoading(false);
      }
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">近くの薬局</h1>
      <p className="text-xs text-gray-500 mb-6">
        現在地から近くのドラッグストア・薬局を検索します（OpenStreetMap データ）
      </p>

      <button
        onClick={searchNearby}
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold mb-6 disabled:opacity-50"
        data-testid="search-pharmacies-button"
      >
        {loading ? "検索中..." : "📍 現在地から探す"}
      </button>

      {error && (
        <div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm" data-testid="error-message">
          {error}
        </div>
      )}

      <div className="space-y-3" data-testid="pharmacy-list">
        {pharmacies.map((p, i) => (
          <div key={i} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-start mb-1">
              <h2 className="font-bold text-sm text-gray-900">{p.name}</h2>
              <span className="text-xs text-indigo-600 whitespace-nowrap ml-2">
                {p.distance_m < 1000
                  ? `${p.distance_m}m`
                  : `${(p.distance_m / 1000).toFixed(1)}km`}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-1">{p.address}</p>
            {p.opening_hours && (
              <p className="text-xs text-gray-400">営業: {p.opening_hours}</p>
            )}
            {p.phone && (
              <a href={`tel:${p.phone}`} className="text-xs text-indigo-600 mt-1 inline-block">
                📞 {p.phone}
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-indigo-600 mt-2 underline"
            >
              地図で開く ↗
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}
