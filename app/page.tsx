import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";

export default function HomePage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10 text-center">
        <div className="mb-4 text-6xl">🍔</div>
        <h1 className="mb-3 text-4xl font-bold">Delivery Super App</h1>
        <p className="text-lg text-muted">
          A plataforma para sua loja receber pedidos online — cardápio, checkout,
          pagamento e gestão, com o link da sua marca.
        </p>
      </div>

      <div
        className={`mb-8 rounded-xl border p-4 text-sm ${
          configured
            ? "border-green-300 bg-green-50 text-green-800"
            : "border-amber-300 bg-amber-50 text-amber-800"
        }`}
      >
        {configured ? (
          <>✅ Supabase conectado. Acesse a loja pelo slug, ex.: <code>/sabor-express</code></>
        ) : (
          <>⚠️ Supabase ainda não configurado. Veja o arquivo <code>SETUP.md</code> para conectar.</>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: "🏪", title: "Cada loja, um link", desc: "meuapp.com/sua-loja com cardápio e tema próprios." },
          { icon: "🧾", title: "Pedidos em tempo real", desc: "Receba e acompanhe pedidos no painel." },
          { icon: "💳", title: "Pague online (em breve)", desc: "PIX e cartão direto no checkout." },
        ].map((f) => (
          <div key={f.title} className="surface bordered rounded-xl p-5">
            <div className="mb-2 text-3xl">{f.icon}</div>
            <h3 className="mb-1 font-semibold">{f.title}</h3>
            <p className="text-sm text-muted">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/admin"
          className="inline-block rounded-full bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-dark"
        >
          Painel do lojista →
        </Link>
        <p className="mt-3 text-xs text-muted">
          (login e painel chegam na sub-etapa 6D)
        </p>
      </div>
    </main>
  );
}
