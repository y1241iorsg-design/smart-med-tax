"use client";
import { useState, useRef, useEffect } from "react";
import { sendChat, type ChatResponse } from "@/lib/api";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  responder?: Pick<ChatResponse, "responder_name" | "responder_title" | "escalation_level">;
};

const BADGE_COLOR: Record<string, string> = {
  ai:                "bg-indigo-100 text-indigo-700",
  registered_seller: "bg-amber-100 text-amber-700",
  pharmacist:        "bg-green-100 text-green-700",
};

const QUICK = [
  "頭痛に効く薬は？",
  "ロキソニンとガスター10を一緒に飲んでもいい？",
  "副作用が心配です",
  "持病があるのですが大丈夫？",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      text: "こんにちは！症状・薬品名・JANコードを入力するとご案内します。",
      responder: { responder_name: "AIアシスタント", responder_title: "自動応答", escalation_level: "ai" },
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", text: msg }]);
    setLoading(true);
    try {
      const res = await sendChat(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: res.reply,
          responder: {
            responder_name: res.responder_name,
            responder_title: res.responder_title,
            escalation_level: res.escalation_level,
          },
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", text: "エラーが発生しました。もう一度お試しください。" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto flex flex-col h-screen pb-16">
      <div className="px-4 py-3 border-b bg-white">
        <h1 className="text-lg font-bold text-gray-900">薬剤コンシェルジュ</h1>
        <p className="text-xs text-gray-500">AIが回答 → 必要に応じて専門家へ引継ぎ</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            data-testid={m.role === "user" ? "user-bubble" : "assistant-bubble"}>
            <div className="max-w-[80%]">
              {m.role === "assistant" && m.responder && (
                <span
                  className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1 ${BADGE_COLOR[m.responder.escalation_level]}`}
                  data-testid="responder-badge"
                >
                  {m.responder.responder_name}・{m.responder.responder_title}
                </span>
              )}
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-white shadow text-gray-800 rounded-tl-sm"
              }`}>
                {m.text}
              </div>
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

      <div className="px-4 py-2 bg-white border-t">
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {QUICK.map((q) => (
            <button key={q} onClick={() => handleSend(q)}
              className="whitespace-nowrap text-xs bg-gray-100 text-gray-600 rounded-full px-3 py-1.5 shrink-0 active:bg-gray-200"
              data-testid="quick-question">
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="症状・薬品名・JANコードを入力..."
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            data-testid="chat-input"
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40 active:bg-indigo-700"
            data-testid="send-button">
            送信
          </button>
        </div>
      </div>
    </main>
  );
}
