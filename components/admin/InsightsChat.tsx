"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Qual foi meu melhor dia este mês?",
  "Que item caiu de vendas?",
  "Qual horário tem mais pedidos?",
];

/** Chat de insights: o lojista pergunta sobre as vendas reais em linguagem natural. */
export default function InsightsChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const history = [...messages, { role: "user" as const, content: q }];
    setMessages(history);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.ok ? data.reply : (data.error ?? "Não consegui analisar agora.") },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Não consegui analisar agora. Tente de novo." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <h2 className="mb-1 font-bold">🤖 Pergunte às suas vendas</h2>
      <p className="mb-3 text-sm text-muted">
        A IA analisa os pedidos reais dos últimos 30 dias e responde em linguagem simples.
      </p>

      {messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border-2 border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div ref={listRef} className="mb-3 max-h-72 space-y-2 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-primary text-white" : "surface-2"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="surface-2 animate-pulse rounded-2xl px-3 py-2 text-sm text-muted">analisando...</div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder="Pergunte algo sobre suas vendas..."
          maxLength={500}
          className="surface w-full rounded-full border-2 border-[var(--border)] px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => ask(input)}
          disabled={busy || !input.trim()}
          aria-label="Perguntar"
          className="shrink-0 rounded-full bg-primary px-4 font-bold text-white disabled:opacity-50"
        >
          ➤
        </button>
      </div>
    </section>
  );
}
