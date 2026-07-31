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
  const [extractedSymptoms, setExtractedSymptoms] = useState<string[]>([]);
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
      setExtractedSymptoms(res.extracted_symptoms);
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
    const query = encodeURIComponent(extractedSymptoms.join(","));
    router.push(`/search?symptoms=${query}`);
  }

  return (
    <main className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-4 py-3 border-b bg-white">
        <h1 className="text-lg font-bold text-gray-900">AIチャット相談</h1>
        <p className="text-xs text-gray-500">
          症状をチャットで入力すると、関連するOTC医薬品の情報をご案内します。診断は行いません。
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

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            data-testid={m.role === "user" ? "user-bubble" : "assistant-bubble"}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-white shadow text-gray-800 rounded-tl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start" data-testid="loading-indicator">
            <div className="bg-white shadow rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-400">
              入力中...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {readyForSearch && (
        <div className="px-4 py-3 bg-indigo-50 border-t border-indigo-100">
          <button
            onClick={goToSearch}
            data-testid="go-to-search-button"
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-indigo-700"
          >
            検索結果を見る
          </button>
        </div>
      )}

      <div className="px-4 py-2 bg-white border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="症状を入力..."
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            data-testid="chat-input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40 active:bg-indigo-700"
            data-testid="send-button"
          >
            送信
          </button>
        </div>
      </div>
    </main>
  );
}
