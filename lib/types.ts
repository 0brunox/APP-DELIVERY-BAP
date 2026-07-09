// Tipos de domínio do delivery super app (espelham o schema do Supabase).

export interface Variation {
  name: string;
  price: number;
}

export interface AddonOption {
  name: string;
  price: number;
}

export interface AddonGroup {
  name: string;
  min: number;
  max: number;
  options: AddonOption[];
}

export type BadgeType = "novo" | "maisvendido" | "promo" | "vegetariano";

export interface StoreTheme {
  primary: string;
  secondary: string;
  font: string;
  heroBanner: string;
}

export interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
}

export interface StoreSettings {
  subtitle?: string;
  whatsappNumber?: string;
  logoUrl?: string;
  deliveryFee?: number;
  minOrderValue?: number;
  currencySymbol?: string;
  exchangeRates?: { USD: number; EUR: number };
  orderTypes?: { delivery: boolean; pickup: boolean; dinein: boolean };
  /** Pagamento presencial na maquininha; card/cash são legados de lojas antigas. */
  paymentMethods?: { pix?: boolean; credit?: boolean; debit?: boolean; card?: boolean; cash?: boolean };
  pix?: { keyType: string; key: string; holder: string };
  enableScheduling?: boolean;
  estimatedTime?: { delivery: string; pickup: string };
  theme?: StoreTheme;
  schedule?: Record<string, DaySchedule>;
}

export interface Store {
  id: string;
  owner: string;
  slug: string;
  name: string;
  settings: StoreSettings;
  order_counter: number;
  created_at: string;
}

/** Traduções do cardápio geradas por IA: {en: {...}, es: {...}} */
export interface Translations {
  en?: { name: string; description?: string };
  es?: { name: string; description?: string };
}

export type MenuLang = "pt" | "en" | "es";

export interface Category {
  id: string;
  store_id: string;
  name: string;
  position: number;
  active: boolean;
  translations?: Translations;
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  promo_price: number | null;
  image: string;
  available: boolean;
  badges: BadgeType[];
  variations: Variation[];
  addon_groups: AddonGroup[];
  position: number;
  created_at: string;
  translations?: Translations;
}

export interface Coupon {
  id: string;
  store_id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  expiry: string | null;
  max_uses: number;
  uses: number;
  active: boolean;
}

export interface DeliveryZone {
  id: string;
  store_id: string;
  name: string;
  fee: number;
}

export type OrderStatus =
  | "received"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type OrderType = "delivery" | "pickup" | "dinein";

export interface OrderItem {
  name: string;
  variation_name: string | null;
  addons: AddonOption[];
  note: string;
  unit_price: number;
  quantity: number;
}

export interface Order {
  id: string;
  store_id: string;
  number: number;
  code: string;
  status: OrderStatus;
  order_type: OrderType;
  customer: Record<string, unknown>;
  payment: string;
  change_for: number | null;
  coupon: { code: string; discount: number } | null;
  schedule_at: string | null;
  ready_at: string | null;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  courier_id: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface Courier {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  token: string;
  active: boolean;
  last_lat: number | null;
  last_lng: number | null;
  location_at: string | null;
  created_at: string;
}
