// Histórico de pedidos salvo no navegador (funciona sem login, mesmo aparelho).

export interface LocalOrder {
  code: string;
  number: number;
  total: number;
  orderType: string;
  createdAt: string; // ISO
}

const MAX = 30;
const key = (slug: string) => `myorders:${slug}`;

export function getLocalOrders(slug: string): LocalOrder[] {
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as LocalOrder[]) : [];
  } catch {
    return [];
  }
}

export function addLocalOrder(slug: string, order: LocalOrder): void {
  try {
    const list = getLocalOrders(slug).filter((o) => o.code !== order.code);
    list.unshift(order);
    localStorage.setItem(key(slug), JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage indisponível — ignora */
  }
}
