import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";

const FEATURES = [
  { icon: "🏪", title: "Cada loja, um link", desc: "Seu cardápio digital em meuapp.com/sua-loja, com a cara e as cores da sua marca." },
  { icon: "🧾", title: "Pedidos em tempo real", desc: "Receba pedidos no painel com som de campainha e acompanhe cada um ao vivo." },
  { icon: "👨‍🍳", title: "Modo Cozinha (KDS)", desc: "Tela cheia para a cozinha, com pedidos em colunas e fonte grande." },
  { icon: "🛵", title: "Entregadores + rastreamento", desc: "Seus motoboys recebem as entregas por um link e o cliente acompanha no mapa ao vivo." },
  { icon: "🤖", title: "IA que ajuda a vender", desc: "Sugestões inteligentes no carrinho e cadastro do cardápio por foto, com IA." },
  { icon: "🍽️", title: "QR code de mesa", desc: "Imprima QRs numerados: o cliente pede pela mesa, sem taxa de entrega." },
  { icon: "⭐", title: "Avaliações", desc: "Receba notas e comentários dos clientes, com selo de média na sua loja." },
  { icon: "📊", title: "Relatórios de vendas", desc: "Faturamento, ticket médio, itens mais vendidos e um chat que responde sobre suas vendas." },
  { icon: "💳", title: "Pagamento flexível", desc: "Crédito, débito ou PIX na maquininha, na entrega ou na retirada." },
];

const STEPS = [
  { n: "1", title: "Cadastre sua loja", desc: "Nome, cor da marca e primeiro produto em um passo a passo de 2 minutos." },
  { n: "2", title: "Monte o cardápio", desc: "Adicione produtos, categorias, variações, adicionais e cupons — ou cadastre por foto com IA." },
  { n: "3", title: "Comece a vender", desc: "Compartilhe seu link, receba pedidos no painel e gerencie tudo em um lugar só." },
];

export default function HomePage() {
  const configured = isSupabaseConfigured();

  return (
    <main>
      {!configured && (
        <div className="mx-auto max-w-3xl px-6 pt-6">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            ⚠️ Supabase ainda não configurado. Veja o arquivo <code>SETUP.md</code> para conectar.
          </div>
        </div>
      )}

      {/* Hero */}
      <section
        className="px-6 py-20 text-center text-white sm:py-28"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur">
            🍔 Delivery Super App
          </div>
          <h1 className="mb-4 text-4xl font-extrabold leading-tight sm:text-5xl">
            Sua loja recebendo pedidos online, do seu jeito.
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg opacity-95">
            Cardápio digital, pedidos em tempo real, entregadores, IA e muito mais —
            tudo com o link da sua marca. Comece grátis, sem mensalidade para dar o primeiro passo.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="w-full rounded-full bg-white px-8 py-3.5 text-base font-bold text-[var(--primary)] shadow-lg transition hover:scale-[1.02] sm:w-auto"
            >
              🚀 Cadastre a sua Loja
            </Link>
            <Link
              href="/sabor-express"
              className="w-full rounded-full border-2 border-white/70 px-8 py-3.5 text-base font-bold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Ver uma loja de exemplo
            </Link>
          </div>
          <p className="mt-4 text-sm opacity-90">Leva menos de 2 minutos para colocar sua loja no ar.</p>
        </div>
      </section>

      {/* Recursos */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="mb-2 text-3xl font-bold">Tudo o que sua loja precisa</h2>
          <p className="text-muted">Uma plataforma completa, do cardápio ao pós-venda.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface bordered rounded-2xl p-5 transition hover:border-primary">
              <div className="mb-2 text-3xl">{f.icon}</div>
              <h3 className="mb-1 font-bold">{f.title}</h3>
              <p className="text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="surface-2 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-2 text-3xl font-bold">Como funciona</h2>
            <p className="text-muted">Do cadastro ao primeiro pedido em 3 passos.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-extrabold text-white">
                  {s.n}
                </div>
                <h3 className="mb-1 font-bold">{s.title}</h3>
                <p className="text-sm text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="mb-3 text-3xl font-bold">Pronto para vender online?</h2>
        <p className="mb-8 text-muted">
          Crie sua loja agora e comece a receber pedidos hoje mesmo.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-full bg-primary px-8 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-primary-dark"
        >
          🚀 Cadastre a sua Loja
        </Link>
        <p className="mt-4 text-sm text-muted">
          Já tem uma conta?{" "}
          <Link href="/admin" className="font-semibold text-primary hover:underline">
            Acesse o painel
          </Link>
        </p>
      </section>

      <footer className="border-t border-[var(--border)] py-8 text-center text-sm text-muted">
        Delivery Super App — a plataforma da sua loja online.
      </footer>
    </main>
  );
}
