export const BADGES: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "#3b82f6" },
  maisvendido: { label: "Mais vendido", color: "#8b5cf6" },
  promo: { label: "Promoção", color: "#ef4444" },
  vegetariano: { label: "Vegetariano", color: "#10b981" },
};

export const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery: "Entrega",
  pickup: "Retirada",
  dinein: "Consumo no local",
};

export const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  card: "Cartão na entrega",
  cash: "Dinheiro",
};
