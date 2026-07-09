"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "📦 Pedidos" },
  { href: "/admin/cardapio", label: "🍔 Cardápio" },
  { href: "/admin/entregadores", label: "🛵 Entregadores" },
  { href: "/admin/mesas", label: "🍽️ Mesas" },
  { href: "/admin/avaliacoes", label: "⭐ Avaliações" },
  { href: "/admin/config", label: "⚙️ Config" },
  { href: "/admin/aparencia", label: "🎨 Aparência" },
  { href: "/admin/relatorios", label: "📊 Relatórios" },
];

export default function AdminTabs() {
  const path = usePathname();
  return (
    <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-5">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 whitespace-nowrap rounded-t-lg px-3.5 py-2 text-sm font-semibold transition ${
              active ? "bg-primary text-white" : "text-muted hover:text-primary"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
