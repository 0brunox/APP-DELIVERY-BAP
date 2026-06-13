"use client";

import { brl } from "@/lib/format";
import { useCart } from "./CartContext";

export default function CartSidebar({
  open,
  onClose,
  onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
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
