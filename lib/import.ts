// Importação do backup da Fase A (app de arquivo único, "sabor-express-backup")
// para o modelo do Supabase. Função pura e testável: recebe o JSON exportado pela
// versão anterior e devolve linhas já no formato snake_case das tabelas, remapeando
// os IDs numéricos de categoria para UUIDs novos.

import type {
  AddonGroup,
  AddonOption,
  BadgeType,
  StoreSettings,
  StoreTheme,
  Variation,
} from "@/lib/types";

const BADGES: readonly string[] = ["novo", "maisvendido", "promo", "vegetariano"];

export interface CategoryRow {
  id: string;
  name: string;
  position: number;
  active: boolean;
}

export interface ProductRow {
  id: string;
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
}

export interface CouponRow {
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  expiry: string | null;
  max_uses: number;
  uses: number;
  active: boolean;
}

export interface ZoneRow {
  name: string;
  fee: number;
}

export interface ParsedBackup {
  storeName: string | null;
  settings: StoreSettings;
  orderCounter: number | null;
  categories: CategoryRow[];
  products: ProductRow[];
  coupons: CouponRow[];
  zones: ZoneRow[];
}

// ---- leitura tolerante (o JSON vem de fonte externa, não confiável) ----
type Dict = Record<string, unknown>;
const asObj = (v: unknown): Dict =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Dict) : {};
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : d;
};

function mapVariations(v: unknown): Variation[] {
  return asArr(v)
    .map(asObj)
    .filter((o) => typeof o.name === "string" && (o.name as string).trim() !== "")
    .map((o) => ({ name: str(o.name), price: num(o.price) }));
}

function mapAddonGroups(v: unknown): AddonGroup[] {
  return asArr(v)
    .map(asObj)
    .filter((o) => typeof o.name === "string")
    .map((o) => {
      const options: AddonOption[] = asArr(o.options)
        .map(asObj)
        .filter((op) => typeof op.name === "string")
        .map((op) => ({ name: str(op.name), price: num(op.price) }));
      return { name: str(o.name), min: num(o.min, 0), max: num(o.max, 0), options };
    });
}

function mapSettings(s: Dict): StoreSettings {
  const themeObj = asObj(s.theme);
  const theme: StoreTheme | undefined = s.theme
    ? {
        primary: str(themeObj.primary, "#f59e0b"),
        secondary: str(themeObj.secondary, "#fbbf24"),
        font: str(themeObj.font, "Poppins"),
        heroBanner: str(themeObj.heroBanner, ""),
      }
    : undefined;

  const ex = asObj(s.exchangeRates);
  const ot = asObj(s.orderTypes);
  const pm = asObj(s.paymentMethods);
  const pix = asObj(s.pix);
  const et = asObj(s.estimatedTime);

  // Note: restaurantName, adminPassword e deliveryZones NÃO entram aqui de propósito
  // (viram coluna name, são descartados, e viram tabela delivery_zones, respectivamente).
  return {
    subtitle: str(s.subtitle) || undefined,
    whatsappNumber: str(s.whatsappNumber) || undefined,
    logoUrl: str(s.logoUrl) || undefined,
    deliveryFee: num(s.deliveryFee),
    minOrderValue: num(s.minOrderValue),
    currencySymbol: str(s.currencySymbol, "R$"),
    exchangeRates: s.exchangeRates ? { USD: num(ex.USD), EUR: num(ex.EUR) } : undefined,
    orderTypes: s.orderTypes
      ? { delivery: bool(ot.delivery, true), pickup: bool(ot.pickup, true), dinein: bool(ot.dinein, false) }
      : undefined,
    paymentMethods: s.paymentMethods
      ? { pix: bool(pm.pix, true), card: bool(pm.card, true), cash: bool(pm.cash, true) }
      : undefined,
    pix: s.pix ? { keyType: str(pix.keyType), key: str(pix.key), holder: str(pix.holder) } : undefined,
    enableScheduling: bool(s.enableScheduling, false),
    estimatedTime: s.estimatedTime ? { delivery: str(et.delivery), pickup: str(et.pickup) } : undefined,
    theme,
    schedule:
      s.schedule && typeof s.schedule === "object"
        ? (s.schedule as StoreSettings["schedule"])
        : undefined,
  };
}

/**
 * Converte o JSON de backup da Fase A em linhas prontas para o Supabase.
 * @param uuid gerador de UUID (injetável para testes determinísticos).
 * @throws Error com mensagem amigável se o arquivo não for um backup válido.
 */
export function parseBackup(raw: string, uuid: () => string = () => crypto.randomUUID()): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Arquivo inválido: não é um JSON válido.");
  }
  const root = asObj(data);
  if (!Array.isArray(root.products) || typeof root.settings !== "object" || root.settings === null) {
    throw new Error(
      'Backup não reconhecido: faltam "products" e/ou "settings". Use o arquivo gerado pelo botão "Exportar Backup (JSON)" da versão anterior.'
    );
  }
  const settingsRaw = asObj(root.settings);

  // Categorias: gera UUID novo e guarda o mapa id-antigo -> uuid (para os produtos).
  const catMap = new Map<string, string>();
  const categories: CategoryRow[] = asArr(root.categories).map((c, i) => {
    const o = asObj(c);
    const id = uuid();
    if (o.id != null) catMap.set(String(o.id), id);
    return { id, name: str(o.name, "Categoria"), position: num(o.order, i), active: bool(o.active, true) };
  });

  // Produtos: remapeia categoryId -> uuid, renomeia campos e normaliza listas.
  const products: ProductRow[] = asArr(root.products).map((p, i) => {
    const o = asObj(p);
    const promo = num(o.promoPrice, NaN);
    const badges = asArr(o.badges).filter(
      (b): b is BadgeType => typeof b === "string" && BADGES.includes(b)
    );
    const legacyCat = o.categoryId;
    return {
      id: uuid(),
      category_id: legacyCat != null && catMap.has(String(legacyCat)) ? catMap.get(String(legacyCat))! : null,
      name: str(o.name, "Produto"),
      description: str(o.description),
      price: num(o.price),
      promo_price: Number.isFinite(promo) && promo > 0 ? promo : null,
      image: str(o.image),
      available: bool(o.available, true),
      badges,
      variations: mapVariations(o.variations),
      addon_groups: mapAddonGroups(o.addonGroups),
      position: i,
    };
  });

  // Cupons: renomeia min_order/max_uses, expiry "" -> null, dedup por código
  // (a tabela tem unique(store_id, code)).
  const seen = new Set<string>();
  const coupons: CouponRow[] = asArr(root.coupons)
    .map(asObj)
    .filter((o) => typeof o.code === "string" && (o.code as string).trim() !== "")
    .map((o) => ({
      code: str(o.code).trim(),
      type: o.type === "fixed" ? ("fixed" as const) : ("percent" as const),
      value: num(o.value),
      min_order: num(o.minOrder),
      expiry: typeof o.expiry === "string" && o.expiry.trim() !== "" ? o.expiry : null,
      max_uses: num(o.maxUses, 0),
      uses: num(o.uses, 0),
      active: bool(o.active, true),
    }))
    .filter((c) => {
      const k = c.code.toUpperCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  // Zonas de entrega: vêm de settings.deliveryZones.
  const zones: ZoneRow[] = asArr(settingsRaw.deliveryZones)
    .map(asObj)
    .filter((o) => typeof o.name === "string")
    .map((o) => ({ name: str(o.name), fee: num(o.fee) }));

  const storeName = str(settingsRaw.restaurantName).trim() || null;
  const oc = num(root.orderCounter, NaN);
  const orderCounter = Number.isFinite(oc) && oc > 0 ? Math.floor(oc) : null;

  return { storeName, settings: mapSettings(settingsRaw), orderCounter, categories, products, coupons, zones };
}
