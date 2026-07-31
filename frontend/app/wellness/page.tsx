"use client";
import { useState } from "react";

const CATEGORIES = [
  { id: "sleep", label: "睡眠", icon: "😴" },
  { id: "diet", label: "食事", icon: "🥗" },
  { id: "exercise", label: "運動", icon: "🚶" },
  { id: "stress", label: "ストレス", icon: "🧘" },
];

const TIPS: Record<string, string[]> = {
  sleep: [
    "就寝2時間前からスマートフォンの使用を控え、寝室は暗く静かに保ちましょう。",
    "毎日同じ時間に起きることで体内時計が整い、寝つきが良くなります。",
    "就寝前のカフェイン摂取は避け、ぬるめの入浴でリラックスを。",
  ],
  diet: [
    "バランスの良い食事（主食・主菜・副菜）を意識し、野菜を毎食取り入れましょう。",
    "水分は1日1.5〜2Lを目安に、こまめに補給してください。",
    "暴飲暴食を避け、規則正しい3食を心がけましょう。",
  ],
  exercise: [
    "無理のない範囲で、1日30分程度のウォーキングから始めましょう。",
    "階段の利用や一駅分歩くなど、日常に運動を取り入れてください。",
    "運動前後のストレッチでケガを予防しましょう。",
  ],
  stress: [
    "深呼吸（4秒吸って7秒止めて8秒吐く）で心を落ち着かせましょう。",
    "趣味の時間や自然の中を散歩する時間を意識的に作りましょう。",
    "悩みは一人で抱え込まず、信頼できる人に話してみてください。",
  ],
};

export default function WellnessPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">養生アドバイス</h1>
      <p className="text-xs text-gray-500 mb-2">
        生活習慣に合わせた健康維持のヒントをご案内します。
      </p>
      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3 mb-6">
        本情報は診断・治療ではなく、一般的な健康維持情報です。体調に不安がある場合は医療機関へご相談ください。
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`flex items-center gap-2 p-4 rounded-xl border text-left ${
              selected === c.id
                ? "bg-indigo-50 border-indigo-500 font-semibold"
                : "bg-white border-gray-200"
            }`}
            data-testid="wellness-category"
          >
            <span className="text-xl">{c.icon}</span>
            <span className="text-sm">{c.label}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-white rounded-xl shadow p-5" data-testid="wellness-tips">
          <h2 className="font-bold text-sm mb-3">
            {CATEGORIES.find((c) => c.id === selected)?.label}のヒント
          </h2>
          <ul className="space-y-3">
            {TIPS[selected].map((tip, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-indigo-500 shrink-0">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
