import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import type { Order, OrderItem } from "@/lib/types";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import OrdersBoard from "@/components/admin/OrdersBoard";
import PlanBanner from "@/components/admin/PlanBanner";
import SetupChecklist, { type SetupStep } from "@/components/admin/SetupChecklist";
import StoreLinkCard from "@/components/admin/StoreLinkCard";

export const dynamic = "force-dynamic";

/** URL pública base (usa o host da requisição; respeita proxy da Vercel). */
async function baseUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type AdminOrder = Order & { order_items: OrderItem[] };

export default async function AdminPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;

  const supabase = await createClient();
  const [{ data: orders }, { data: couriers }, { count: productCount }, { count: zoneCount }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("couriers")
        .select("id, name")
        .eq("store_id", store.id)
        .eq("active", true)
        .order("name"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
      supabase.from("delivery_zones").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    ]);

  const storeUrl = `${await baseUrl()}/${store.slug}`;

  const s = store.settings ?? {};
  const deliveryOn = s.orderTypes?.delivery ?? true;
  const steps: SetupStep[] = [
    {
      key: "products",
      label: "Adicione produtos ao cardápio",
      href: "/admin/cardapio",
      done: (productCount ?? 0) > 0,
    },
    {
      key: "contact",
      label: "Informe WhatsApp e horário de funcionamento",
      href: "/admin/config",
      done: Boolean(s.whatsappNumber?.trim()),
    },
    {
      key: "delivery",
      label: "Configure a entrega (taxa ou zonas por bairro)",
      href: "/admin/config",
      done: !deliveryOn || (s.deliveryFee ?? 0) > 0 || (zoneCount ?? 0) > 0,
    },
    {
      key: "appearance",
      label: "Personalize a aparência (logo e cores)",
      href: "/admin/aparencia",
      done: Boolean(s.logoUrl?.trim()),
    },
    {
      key: "testorder",
      label: "Faça um pedido de teste na sua loja",
      href: `/${store.slug}`,
      done: (orders?.length ?? 0) > 0,
    },
  ];

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{store.name}</h1>
        </div>
        <Link
          href="/admin/cozinha"
          className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
        >
          👨‍🍳 Modo cozinha
        </Link>
      </div>
      <StoreLinkCard url={storeUrl} />
      <SetupChecklist steps={steps} storeSlug={store.slug} />
      <PlanBanner storeId={store.id} />
      <OrdersBoard
        initialOrders={(orders ?? []) as AdminOrder[]}
        storeId={store.id}
        couriers={(couriers ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
