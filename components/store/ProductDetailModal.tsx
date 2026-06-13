"use client";

import { useMemo, useState } from "react";
import type { AddonOption, Product } from "@/lib/types";
import { brl, basePrice } from "@/lib/format";
import { BADGES } from "@/lib/constants";
import { useCart } from "./CartContext";

export default function ProductDetailModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { addLine } = useCart();
  const [variationName, setVariationName] = useState<string | null>(
    product.variations[0]?.name ?? null
  );
  // Adicionais selecionados por "grupoIndex:opcaoIndex"
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");

  const chosenAddons: AddonOption[] = useMemo(() => {
    const list: AddonOption[] = [];
    product.addon_groups.forEach((g, gi) =>
      g.options.forEach((o, oi) => {
        if (selected[`${gi}:${oi}`]) list.push({ name: o.name, price: o.price });
      })
    );
    return list;
  }, [selected, product]);

  const unitPrice = useMemo(() => {
    const variation = variationName
      ? product.variations.find((v) => v.name === variationName)
      : null;
    const base = variation ? variation.price : basePrice(product);
    return base + chosenAddons.reduce((s, a) => s + a.price, 0);
  }, [variationName, chosenAddons, product]);

  function toggleAddon(gi: number, oi: number) {
    const key = `${gi}:${oi}`;
    const group = product.addon_groups[gi];
    const checkedInGroup = group.options.filter(
      (_, i) => selected[`${gi}:${i}`]
    ).length;
    // Respeita o máximo do grupo (0 = sem limite)
    if (!selected[key] && group.max > 0 && checkedInGroup >= group.max) return;
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleAdd() {
    // Valida mínimos obrigatórios
    for (let gi = 0; gi < product.addon_groups.length; gi++) {
      const group = product.addon_groups[gi];
      if (group.min > 0) {
        const count = group.options.filter((_, oi) => selected[`${gi}:${oi}`]).length;
        if (count < group.min) {
          setError(`Escolha pelo menos ${group.min} opção(ões) em "${group.name}".`);
          return;
        }
      }
    }
    addLine(product, variationName, chosenAddons, note, qty);
    onClose();
  }

  const badges = product.badges.filter((b) => BADGES[b]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="surface flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl">
        <div className="relative h-52 w-full shrink-0 bg-[var(--surface-2)]">
          {product.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          )}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/80"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {badges.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                  style={{ background: BADGES[b].color }}
                >
                  {BADGES[b].label}
                </span>
              ))}
            </div>
          )}
          <h3 className="text-2xl font-bold">{product.name}</h3>
          <p className="mb-4 text-sm text-muted">{product.description}</p>

          {/* Variações */}
          {product.variations.length > 0 && (
            <div className="mb-5">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">Escolha o tamanho</span>
                <span className="text-xs text-muted">obrigatório</span>
              </div>
              {product.variations.map((v) => (
                <label
                  key={v.name}
                  className={`mt-2 flex cursor-pointer items-center gap-3 rounded-xl border-2 p-2.5 transition ${
                    variationName === v.name
                      ? "border-primary bg-[var(--surface-2)]"
                      : "border-[var(--border)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="variation"
                    className="h-[18px] w-[18px] accent-[var(--primary)]"
                    checked={variationName === v.name}
                    onChange={() => setVariationName(v.name)}
                  />
                  <span className="flex-1 text-sm">{v.name}</span>
                  <span className="text-sm font-semibold text-primary">{brl(v.price)}</span>
                </label>
              ))}
            </div>
          )}

          {/* Grupos de adicionais */}
          {product.addon_groups.map((group, gi) => {
            const hints = [];
            if (group.min > 0) hints.push(`mín. ${group.min}`);
            if (group.max > 0) hints.push(`máx. ${group.max}`);
            const checkedInGroup = group.options.filter((_, oi) => selected[`${gi}:${oi}`]).length;
            return (
              <div key={gi} className="mb-5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">{group.name}</span>
                  <span className="text-xs text-muted">{hints.join(" · ") || "opcional"}</span>
                </div>
                {group.options.map((o, oi) => {
                  const key = `${gi}:${oi}`;
                  const isChecked = !!selected[key];
                  const locked = !isChecked && group.max > 0 && checkedInGroup >= group.max;
                  return (
                    <label
                      key={oi}
                      className={`mt-2 flex items-center gap-3 rounded-xl border-2 p-2.5 transition ${
                        isChecked ? "border-primary bg-[var(--surface-2)]" : "border-[var(--border)]"
                      } ${locked ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        className="h-[18px] w-[18px] accent-[var(--primary)]"
                        checked={isChecked}
                        disabled={locked}
                        onChange={() => toggleAddon(gi, oi)}
                      />
                      <span className="flex-1 text-sm">{o.name}</span>
                      <span className="text-sm font-semibold text-primary">+ {brl(o.price)}</span>
                    </label>
                  );
                })}
              </div>
            );
          })}

          {/* Observações */}
          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">Observações</span>
              <span className="text-xs text-muted">opcional</span>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Ex: sem cebola, ponto da carne, cortar em 8..."
              className="surface w-full resize-y rounded-xl border-2 border-[var(--border)] p-3 text-sm outline-none focus:border-primary"
              rows={2}
            />
          </div>

          {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
        </div>

        {/* Rodapé: quantidade + adicionar */}
        <div className="surface flex shrink-0 items-center gap-3 border-t border-[var(--border)] p-4">
          <div className="flex items-center gap-3 rounded-full border-2 border-[var(--border)] px-3 py-1.5">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Diminuir"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-2)] text-lg font-bold hover:bg-primary hover:text-white"
            >
              −
            </button>
            <span className="min-w-6 text-center font-bold">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              aria-label="Aumentar"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-2)] text-lg font-bold hover:bg-primary hover:text-white"
            >
              +
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex-1 rounded-full bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary-dark"
          >
            Adicionar {qty}x — {brl(unitPrice * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}
