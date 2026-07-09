"use client";

import { useEffect, useRef, useState } from "react";
import type { AddonOption, Product } from "@/lib/types";
import { useCart } from "./CartContext";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  added?: number; // itens adicionados ao carrinho por esta resposta
}

interface WaiterAction {
  product_id: string;
  variation_name: string | null;
  addons: AddonOption[];
  note: string;
  quantity: number;
}

/** Chat flutuante do garçom virtual: monta o carrinho de verdade via IA. */
export default function WaiterChat({
  storeId,
  products,
}: {
  storeId: string;
  products: Product[];
}) {
  const { addLine } = useCart();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Só mostra o botão se a plataforma tiver IA configurada.
  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (!enabled) return null;

  function applyActions(actions: WaiterAction[]): number {
    let added = 0;
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const a of actions) {
      const product = byId.get(a.product_id);
      if (!product) continue;
      addLine(product, a.variation_name, a.addons, a.note, a.quantity);
      added += a.quantity;
    }
    return added;
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/waiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: data.error ?? "Tive um problema aqui. Pode tentar de novo?" }]);
        return;
      }
      const added = applyActions((data.actions ?? []) as WaiterAction[]);
      setMessages((m) => [...m, { role: "assistant", content: data.reply, added }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Não consegui responder agora. Tente novamente." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            if (messages.length === 0) {
              setMessages([
                {
                  role: "assistant",
                  content: "Oi! Sou o garçom virtual. 😊 Me diga o que você quer — pode ser algo como \"monta um combo pra 2 pessoas até R$ 80, sem cebola\" — que eu coloco no seu carrinho.",
                },
              ]);
            }
          }}
          className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-white shadow-xl transition hover:bg-primary-dark"
          aria-label="Abrir garçom virtual"
        >
          🤵 Garçom virtual
        </button>
      )}

      {/* Painel de chat */}
      {open && (
        <div className="surface bordered fixed bottom-5 left-5 z-40 flex h-[480px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-white">
            <span className="font-bold">🤵 Garçom virtual</span>
            <button onClick={() => setOpen(false)} aria-label="Fechar chat" className="text-xl leading-none">
              ✕
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-primary text-white" : "surface-2"
                  }`}
                >
                  {m.content}
                  {m.added ? (
                    <div className="mt-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                      🛒 {m.added} item{m.added > 1 ? "s" : ""} no carrinho!
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="surface-2 animate-pulse rounded-2xl px-3 py-2 text-sm text-muted">digitando...</div>
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-[var(--border)] p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ex: um combo pra 2 até R$ 80"
              maxLength={500}
              className="surface w-full rounded-full border-2 border-[var(--border)] px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label="Enviar"
              className="shrink-0 rounded-full bg-primary px-4 font-bold text-white disabled:opacity-50"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
