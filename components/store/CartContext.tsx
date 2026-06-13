"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Product, AddonOption } from "@/lib/types";
import {
  type CartLine,
  buildSignature,
  computeUnitPrice,
  cartSubtotal,
  cartCount,
} from "@/lib/cart";

interface CartContextValue {
  cart: CartLine[];
  subtotal: number;
  count: number;
  addLine: (
    product: Product,
    variationName: string | null,
    addons: AddonOption[],
    note: string,
    quantity: number
  ) => void;
  updateQty: (lineId: number, delta: number) => void;
  removeLine: (lineId: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: React.ReactNode;
}) {
  const storageKey = `cart:${storeSlug}`;
  const [cart, setCart] = useState<CartLine[]>([]);
  const seq = useRef<number>(Date.now());
  const loaded = useRef(false);

  // Carrega o carrinho salvo (uma vez)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      /* ignora carrinho corrompido */
    }
    loaded.current = true;
  }, [storageKey]);

  // Persiste a cada mudança (após o carregamento inicial)
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* storage indisponível */
    }
  }, [cart, storageKey]);

  function addLine(
    product: Product,
    variationName: string | null,
    addons: AddonOption[],
    note: string,
    quantity: number
  ) {
    const unitPrice = computeUnitPrice(product, variationName, addons);
    const signature = buildSignature(product.id, variationName, addons, note);
    setCart((prev) => {
      const existing = prev.find((l) => l.signature === signature);
      if (existing) {
        return prev.map((l) =>
          l.signature === signature ? { ...l, quantity: l.quantity + quantity } : l
        );
      }
      return [
        ...prev,
        {
          lineId: ++seq.current,
          signature,
          productId: product.id,
          name: product.name,
          image: product.image,
          variationName: variationName ?? null,
          addons,
          note: note.trim(),
          unitPrice,
          quantity,
        },
      ];
    });
  }

  function updateQty(lineId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(lineId: number) {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  function clear() {
    setCart([]);
  }

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      subtotal: cartSubtotal(cart),
      count: cartCount(cart),
      addLine,
      updateQty,
      removeLine,
      clear,
    }),
    [cart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de <CartProvider>");
  return ctx;
}
