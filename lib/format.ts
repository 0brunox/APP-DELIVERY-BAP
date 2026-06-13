import type { Product } from "./types";

/** Formata um valor em BRL (R$ 1.234,56). */
export function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

/** Há promoção válida? (preço promocional menor que o normal e sem variações) */
export function hasPromo(p: Product): boolean {
  return (
    typeof p.promo_price === "number" &&
    p.promo_price > 0 &&
    p.promo_price < p.price &&
    p.variations.length === 0
  );
}

/** Preço base efetivo (considera promoção). */
export function basePrice(p: Product): number {
  return hasPromo(p) ? (p.promo_price as number) : p.price;
}

/** Menor preço exibido (a partir de…), considerando variações. */
export function minPrice(p: Product): number {
  return p.variations.length
    ? Math.min(...p.variations.map((v) => v.price))
    : basePrice(p);
}
