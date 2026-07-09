import { headers } from "next/headers";
import QRCode from "qrcode";
import { getOwnerStore } from "@/lib/admin";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import TableQRGrid from "@/components/admin/TableQRGrid";

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

export default async function MesasPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;

  const base = await baseUrl();
  const storeUrl = `${base}/${store.slug}`;

  // QR genérico da loja (vitrine/balcão) + QRs numerados de mesa 1 a 20.
  const generic = await QRCode.toDataURL(storeUrl, { margin: 1, width: 320 });
  const tables = await Promise.all(
    Array.from({ length: 20 }, (_, i) => i + 1).map(async (n) => ({
      n,
      url: `${storeUrl}?mesa=${n}`,
      dataUrl: await QRCode.toDataURL(`${storeUrl}?mesa=${n}`, { margin: 1, width: 320 }),
    }))
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">🍽️ QR Codes de mesa</h1>
      <p className="mb-5 text-sm text-muted">
        Imprima e coloque nas mesas. O cliente escaneia, o pedido entra marcado com a mesa e{" "}
        <strong>sem taxa de entrega</strong>. O QR genérico serve para vitrine ou balcão.
      </p>
      <TableQRGrid storeName={store.name} generic={{ url: storeUrl, dataUrl: generic }} tables={tables} />
    </div>
  );
}
