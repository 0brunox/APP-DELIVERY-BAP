import type { Product } from "./types";

/** Escurece uma cor hex por um fator (0–1) — usado para derivar "primary-dark". */
export function darkenColor(hex: string, amount = 0.18): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const ch = (c: string) =>
    Math.max(0, Math.round(parseInt(c, 16) * (1 - amount)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(m[1])}${ch(m[2])}${ch(m[3])}`;
}

/** Remove acentos para busca. */
export function normalizeText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

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
