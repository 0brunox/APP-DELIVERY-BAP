"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { brl, basePrice } from "@/lib/format";
import { useCart } from "./CartContext";

export default function CartSidebar({
  open,
  onClose,
  onCheckout,
  storeId,
  products = [],
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  storeId?: string;
  products?: Product[];
}) {
  const { cart, subtotal, updateQty, removeLine, clear } = useCart();

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`surface fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col shadow-2xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
          <h2 className="text-xl font-bold">Meu Carrinho</h2>
          <button onClick={onClose} aria-label="Fechar carrinho" className="text-2xl text-muted hover:text-[var(--text)]">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div className="py-16 text-center text-muted">
              <div className="mb-3 text-5xl opacity-30">🛒</div>
              <p>Seu carrinho está vazio</p>
            </div>
          ) : (
            cart.map((line) => {
              const meta = [
                line.variationName,
                ...line.addons.map((a) => `+ ${a.name}`),
              ].filter(Boolean);
              return (
                <div key={line.lineId} className="surface-2 mb-3 flex gap-3 rounded-xl p-3">
                  {line.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.image} alt={line.name} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold">{line.name}</div>
                    {meta.length > 0 && (
                      <div className="text-xs text-muted">{meta.join(" · ")}</div>
                    )}
                    {line.note && <div className="text-xs italic text-muted">Obs: {line.note}</div>}
                    <div className="text-sm font-semibold text-primary">{brl(line.unitPrice)}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        onClick={() => updateQty(line.lineId, -1)}
                        aria-label="Diminuir"
                        className="surface flex h-7 w-7 items-center justify-center rounded-full font-bold hover:bg-primary hover:text-white"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center font-semibold">{line.quantity}</span>
                      <button
                        onClick={() => updateQty(line.lineId, 1)}
                        aria-label="Aumentar"
                        className="surface flex h-7 w-7 items-center justify-center rounded-full font-bold hover:bg-primary hover:text-white"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeLine(line.lineId)}
                        aria-label="Remover"
                        className="ml-1 text-red-500 hover:scale-110"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="text-right font-semibold">{brl(line.unitPrice * line.quantity)}</div>
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && storeId && (
          <UpsellSuggestions open={open} storeId={storeId} products={products} />
        )}

        {cart.length > 0 && (
          <div className="surface-2 border-t border-[var(--border)] p-5">
            <div className="mb-3 flex justify-between text-lg font-bold">
              <span>Subtotal</span>
              <span>{brl(subtotal)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="mb-2 w-full rounded-xl bg-whatsapp py-3 font-semibold text-white transition hover:brightness-95"
            >
              Finalizar pedido
            </button>
            <button
              onClick={clear}
              className="w-full rounded-xl border-2 border-red-500 py-2.5 font-semibold text-red-500 transition hover:bg-red-500 hover:text-white"
            >
              Limpar carrinho
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

/** Sugestões de upsell da IA: "que tal juntar...?" (1 clique para adicionar). */
function UpsellSuggestions({
  open,
  storeId,
  products,
}: {
  open: boolean;
  storeId: string;
  products: Product[];
}) {
  const { cart, addLine } = useCart();
  const [suggestions, setSuggestions] = useState<{ product: Product; reason: string }[]>([]);
  const lastKey = useRef("");

  const cartNames = cart.map((l) => l.name);
  const key = cartNames.slice().sort().join("|");

  useEffect(() => {
    if (!open || cart.length === 0 || key === lastKey.current) return;
    lastKey.current = key;
    setSuggestions([]);
    const ctrl = new AbortController();
    fetch("/api/ai/upsell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, cartNames }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data: { suggestions: { product_id: string; reason: string }[] }) => {
        const byId = new Map(products.map((p) => [p.id, p]));
        setSuggestions(
          (data.suggestions ?? [])
            .map((s) => ({ product: byId.get(s.product_id)!, reason: s.reason }))
            .filter((s) => s.product)
        );
      })
      .catch(() => setSuggestions([]));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, storeId]);

  if (suggestions.length === 0) return null;

  return (
    <div className="border-t border-[var(--border)] px-5 py-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">✨ Que tal juntar?</div>
      <div className="space-y-2">
        {suggestions.map(({ product, reason }) => (
          <div key={product.id} className="surface-2 flex items-center gap-2 rounded-xl p-2">
            {product.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt={product.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{product.name}</div>
              <div className="truncate text-xs text-muted">{reason}</div>
            </div>
            <span className="text-sm font-semibold text-primary">{brl(basePrice(product))}</span>
            <button
              onClick={() => {
                addLine(product, null, [], "", 1);
                setSuggestions((s) => s.filter((x) => x.product.id !== product.id));
              }}
              className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white transition hover:bg-primary-dark"
            >
              + Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
