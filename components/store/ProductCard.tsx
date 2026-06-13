"use client";

import type { Product } from "@/lib/types";
import { brl, hasPromo, minPrice, basePrice } from "@/lib/format";
import { BADGES } from "@/lib/constants";

export default function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  const badges = product.badges.filter((b) => BADGES[b]);
  const hasOptions = product.variations.length > 0 || product.addon_groups.length > 0;

  return (
    <article
      className="surface bordered cursor-pointer overflow-hidden rounded-2xl transition hover:-translate-y-1 hover:shadow-lg"
      onClick={() => onOpen(product)}
    >
      <div className="relative h-44 w-full bg-[var(--surface-2)]">
        {product.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        )}
        {badges.length > 0 && (
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
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
        {!product.available && (
          <span className="absolute right-3 top-3 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
            Esgotado
          </span>
        )}
      </div>
      <div className="p-4">
        <h4 className="font-semibold">{product.name}</h4>
        <p className="mb-3 line-clamp-2 text-sm text-muted">{product.description}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-primary">
            {product.variations.length > 0 && (
              <span className="block text-[11px] font-medium text-muted">a partir de</span>
            )}
            {hasPromo(product) && (
              <span className="mr-1 text-sm font-medium text-muted line-through">{brl(product.price)}</span>
            )}
            <span className="text-lg">{brl(product.variations.length ? minPrice(product) : basePrice(product))}</span>
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(product);
            }}
            disabled={!product.available}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {product.available ? (hasOptions ? "Escolher" : "+ Adicionar") : "Indisponível"}
          </button>
        </div>
      </div>
    </article>
  );
}
