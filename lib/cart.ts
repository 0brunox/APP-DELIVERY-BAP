import type { AddonOption, Product } from "./types";
import { basePrice } from "./format";

/** Uma linha do carrinho: produto + variação + adicionais + observação. */
export interface CartLine {
  lineId: number;
  signature: string;
  productId: string;
  name: string;
  image: string;
  variationName: string | null;
  addons: AddonOption[];
  note: string;
  unitPrice: number;
  quantity: number;
}

/** Assinatura para deduplicar linhas idênticas (mesma config soma quantidade). */
export function buildSignature(
  productId: string,
  variationName: string | null,
  addons: AddonOption[],
  note: string
): string {
  return JSON.stringify([
    productId,
    variationName ?? "",
    addons.map((a) => a.name).sort(),
    note.trim(),
  ]);
}

/** Preço unitário de uma escolha (variação ou base) + adicionais. */
export function computeUnitPrice(
  product: Product,
  variationName: string | null,
  addons: AddonOption[]
): number {
  const variation = variationName
    ? product.variations.find((v) => v.name === variationName)
    : null;
  const base = variation ? variation.price : basePrice(product);
  return base + addons.reduce((sum, a) => sum + a.price, 0);
}

export function cartSubtotal(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.quantity, 0);
}
