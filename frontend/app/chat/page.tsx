"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendChatTurn, type ChatTurn } from "@/lib/api";

type Message = ChatTurn & { id: number };

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      text: "こんにちは。今日はどのような症状でお悩みですか?(例:頭痛、鼻水、のどの痛みなど)",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [escalate, setEscalate] = useState(false);
  const [readyForSearch, setReadyForSearch] = useState(false);
  const [awaitingMeds, setAwaitingMeds] = useState(false);
  const [extractedSymptoms, setExtractedSymptoms] = useState<string[]>([]);
  const [currentMeds, setCurrentMeds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const nextHistory: Message[] = [...messages, { id: Date.now(), role: "user", text }];
    setMessages(nextHistory);
    setLoading(true);
    try {
      const res = await sendChatTurn(nextHistory.map(({ role, text }) => ({ role, text })));
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", text: res.reply }]);
      setEscalate(res.escalate);
      setReadyForSearch(res.ready_for_search);
      setAwaitingMeds(Boolean(res.awaiting_meds));
      if (res.extracted_symptoms.length > 0) {
        setExtractedSymptoms(res.extracted_symptoms);
      }
      setCurrentMeds(res.current_meds ?? []);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", text: "エラーが発生しました。もう一度お試しください。" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function goToSearch() {
    const params = new URLSearchParams();
    params.set("symptoms", extractedSymptoms.join(","));
    if (currentMeds.length > 0) {
      params.set("meds", currentMeds.join(","));
    }
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] animate-fade-in">
      <div className="px-5 py-4 bg-white">
        <h1 className="text-lg font-bold text-gray-800">症状キーワード相談</h1>
        <p className="text-[11px] text-gray-500 mt-0.5">
          症状と服用中の薬をうかがい、添付文書の効能に合う商品情報を表示します。診断は行いません。
        </p>
      </div>

      {escalate && (
        <div
          className="bg-red-50 border-b-2 border-red-300 text-red-800 px-4 py-3 text-sm font-medium"
          data-testid="escalation-banner"
        >
          ⚠ 医療機関の受診をご検討ください。本サービスは診断を行うものではありません。
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: "#FFFBF7" }}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            data-testid={m.role === "user" ? "user-bubble" : "assistant-bubble"}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "text-gray-900 rounded-tr-sm"
                  : "shadow-sm text-gray-800 rounded-tl-sm"
              }`}
              style={
                m.role === "user"
                  ? { background: "#B3E5FC" }
                  : { background: "#FFF9C4" }
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start" data-testid="loading-indicator">
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-400"
              style={{ background: "#F8BBD0" }}
            >
              入力中...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {readyForSearch && (
        <div className="px-4 py-3 border-t" style={{ background: "#DCEDC8" }}>
          <button
            onClick={goToSearch}
            data-testid="go-to-search-button"
            className="w-full text-gray-900 py-3 rounded-xl font-semibold text-sm"
            style={{ background: "#FFE0B2" }}
          >
            検索結果を見る
          </button>
        </div>
      )}

      <div className="px-4 py-2 bg-white border-t">
        {awaitingMeds && (
          <div className="flex gap-2 mb-2">
            {["なし", "A解熱鎮痛薬", "Rx-F鎮痛薬"].map((quick) => (
              <button
                key={quick}
                type="button"
                onClick={() => setInput(quick)}
                className="text-xs px-2.5 py-1 rounded-full text-gray-700"
                style={{ background: "#E3F2FD" }}
                data-testid="med-quick-chip"
              >
                {quick}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={awaitingMeds ? "服用中の薬、または「なし」" : "症状を入力..."}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCCBC]"
            data-testid="chat-input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="text-gray-900 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
            style={{ background: "#FFCCBC" }}
            data-testid="send-button"
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
