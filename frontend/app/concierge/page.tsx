"use client";
import { useState } from "react";
import { checkInteractions, type InteractionCheckResult } from "@/lib/api";

const MOCK_PHARMACISTS = [
  { name: "田中 誠", title: "薬剤師", rating: 4.8, area: "渋谷区" },
  { name: "山田 花子", title: "登録販売者", rating: 4.6, area: "新宿区" },
  { name: "佐藤 健", title: "薬剤師", rating: 4.9, area: "港区" },
];

const MOCK_SLOTS = ["今日 14:00", "今日 16:30", "明日 10:00", "明日 13:00"];

export default function ConciergePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function handleConfirm() {
    if (selected && slot) setConfirmed(true);
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">OTC コンシェルジュ</h1>
      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3 mb-6">
        ⚠ 本画面はデモ用の予約フローです。実際の専門家相談機能は今後提供予定です。
      </p>

      {confirmed ? (
        <div className="bg-green-100 text-green-800 rounded-xl p-6 text-center" data-testid="booking-confirmed">
          <p className="text-2xl mb-2">✓</p>
          <p className="font-bold">{selected} との面談を予約しました</p>
          <p className="text-sm mt-2">{slot}</p>
        </div>
      ) : (
        <>
          <h2 className="font-semibold text-sm text-gray-700 mb-3">専門家を選ぶ</h2>
          <div className="space-y-2 mb-6">
            {MOCK_PHARMACISTS.map((p) => (
              <button
                key={p.name}
                onClick={() => setSelected(p.name)}
                className={`w-full text-left bg-white rounded-xl shadow p-4 border-2 transition-all ${
                  selected === p.name ? "border-indigo-500 bg-indigo-50" : "border-transparent"
                }`}
                data-testid="pharmacist-card"
              >
                <p className="font-bold text-sm">{p.name}</p>
                <p className="text-xs text-gray-500">
                  {p.title} · {p.area} · ★{p.rating}
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <>
              <h2 className="font-semibold text-sm text-gray-700 mb-3">空き枠を選ぶ</h2>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {MOCK_SLOTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`py-3 rounded-xl text-sm border ${
                      slot === s
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white border-gray-200 text-gray-700"
                    }`}
                    data-testid="time-slot"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            onClick={handleConfirm}
            disabled={!selected || !slot}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold disabled:opacity-40"
            data-testid="confirm-booking-button"
          >
            予約を確定する
          </button>
        </>
      )}
    </main>
  );
}
