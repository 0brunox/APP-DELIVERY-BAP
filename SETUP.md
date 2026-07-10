# 🚀 Setup & Deploy — Delivery Super App

Este projeto migrou de um único `index.html` (preservado em [`/legacy`](legacy/)) para
um app **Next.js + Supabase**, pronto para publicar na **Vercel**.

## Pré-requisitos
- Node.js 18+ (recomendado 20+)
- Uma conta gratuita no [Supabase](https://supabase.com)
- Para publicar: uma conta no [GitHub](https://github.com) e outra na [Vercel](https://vercel.com) (ambas free)

---

## Parte 1 — Rodar localmente

### 1) Instalar dependências
```bash
npm install
```

### 2) Criar o projeto no Supabase
1. Acesse https://supabase.com e crie um projeto (o free tier serve).
2. No menu lateral, abra **SQL Editor → New query**.
3. Rode as migrations **em ordem**, uma por vez (cole o conteúdo do arquivo e clique **Run**):

   | Arquivo | O que cria |
   |---------|-----------|
   | [`0001_init.sql`](supabase/migrations/0001_init.sql) | Tabelas, RLS, `place_order`/`validate_coupon`/`get_order_by_code`, bucket `product-images`, realtime em `orders` |
   | [`0002_order_status_broadcast.sql`](supabase/migrations/0002_order_status_broadcast.sql) | Status do pedido ao vivo p/ o cliente (broadcast) |
   | [`0003_prep_time.sql`](supabase/migrations/0003_prep_time.sql) | Tempo de preparo / previsão de pronto |
   | [`0004_push.sql`](supabase/migrations/0004_push.sql) | Web Push (notificação de novo pedido) |
   | [`0005_hardening.sql`](supabase/migrations/0005_hardening.sql) | Segurança: preços e taxa recalculados no servidor |
   | [`0006_couriers.sql`](supabase/migrations/0006_couriers.sql) | Entregadores + rastreamento ao vivo |
   | [`0007_ai.sql`](supabase/migrations/0007_ai.sql) | IA: limite de uso, itens populares, traduções |
   | [`0008_platform.sql`](supabase/migrations/0008_platform.sql) | Planos, avaliações, QR de mesa, super-admin da plataforma |

   > ⚠️ Na `0008` há um `insert` que cadastra o **e-mail do admin da plataforma**. Troque
   > `brunocorreia65@gmail.com` pelo seu e-mail (o mesmo do login) antes de rodar, se for outro.

### 3) Conectar o app ao Supabase
1. No Supabase, vá em **Project Settings → API**.
2. Copie a **Project URL** e a chave pública (**Publishable key** `sb_publishable_...` ou a **anon public**).
3. Na raiz do projeto, copie `.env.example` para `.env.local`:
   ```bash
   copy .env.example .env.local   # Windows
   # cp .env.example .env.local    # Mac/Linux
   ```
4. Cole os valores em `.env.local`.

### 4) Rodar
```bash
npm run dev
```
Abra http://localhost:3000. Sem `.env.local`, o app roda e mostra uma tela pedindo para conectar o Supabase.

### 5) Criar sua loja
1. Acesse http://localhost:3000/login e **crie uma conta** (e-mail + senha).
2. ⚠️ A confirmação de e-mail vem **ligada** por padrão no Supabase: confirme pelo link
   enviado antes de entrar. (Para testar rápido, dá para desligar em
   **Authentication → Providers → Email → "Confirm email"**.)
3. Logado, o painel **/admin** pede para criar sua loja (nome + slug). Pronto — gerencie
   cardápio, configurações, aparência e relatórios.

Atalhos opcionais:
- **Loja demo:** rode [`supabase/seed.sql`](supabase/seed.sql) no SQL Editor (depois de criar
  ao menos 1 usuário) para popular a loja de exemplo `sabor-express` com cardápio, cupom e zonas.
- **Migrar da versão antiga:** no painel, **Configurações → Importar backup**, e envie o JSON
  exportado pelo app de arquivo único (`/legacy`).

A loja pública fica em `http://localhost:3000/<slug>` (ex.: `/sabor-express`).

---

## Parte 2 — Deploy na Vercel

### 1) Subir o código para o GitHub
Crie um repositório no GitHub e envie o projeto (o `.env.local` **não** sobe — está no `.gitignore`):
```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin master
```

### 2) Importar o projeto na Vercel
1. Em https://vercel.com, clique **Add New → Project** e importe o repositório do GitHub.
2. A Vercel detecta o **Next.js** automaticamente (build `next build`) — não precisa configurar nada do build.

### 3) Configurar as variáveis de ambiente
Em **Settings → Environment Variables**, adicione (marque *Production* e *Preview*):

| Nome | Obrigatória? | Valor |
|------|:---:|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | a sua Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | a sua chave pública (`sb_publishable_...` ou anon) |
| `NEXT_PUBLIC_SITE_URL` | recomendada | `https://seu-app.vercel.app` (usado no sitemap e nos QR codes de mesa; sem ela, cai no host da requisição) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | p/ Web Push | chave pública VAPID |
| `VAPID_PRIVATE_KEY` | p/ Web Push | chave privada VAPID (**segredo**) |
| `VAPID_SUBJECT` | p/ Web Push | `mailto:voce@seudominio.com` |
| `ANTHROPIC_API_KEY` | p/ IA | chave de https://console.anthropic.com (**segredo**) |
| `AI_MODEL` | opcional | `claude-haiku-4-5` (padrão, mais barato); use `claude-sonnet-5` ou `claude-opus-4-8` p/ mais qualidade |
| `AI_DAILY_LIMIT` | opcional | limite diário de chamadas de IA por loja (padrão 300) |

- **Web Push:** gere o par de chaves uma vez com `npx web-push generate-vapid-keys --json`. Sem elas, o app funciona — só não envia notificação de novo pedido.
- **IA:** sem `ANTHROPIC_API_KEY`, os recursos de IA (garçom virtual, upsell, foto, insights, tradução) ficam ocultos e o resto do app funciona normalmente.
- Não precisa de `NEXT_TELEMETRY_DISABLED` — aquilo era só um contorno do ambiente local (Windows/OneDrive).

### 4) Publicar
Clique **Deploy**. Em ~1 minuto você terá `https://seu-app.vercel.app`.

### 5) ⚠️ Apontar a autenticação para o domínio de produção (importante!)
Sem este passo, os **links de confirmação de e-mail apontam para `localhost`** e o login no ar não fecha o ciclo.

No Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://seu-app.vercel.app`
- **Redirect URLs:** adicione `https://seu-app.vercel.app/**`

Salve. Agora cadastro, confirmação e login funcionam em produção.

### 6) Testar no ar
- `https://seu-app.vercel.app/<slug>` → cardápio público
- `/login` → painel do lojista
- Faça um pedido de teste → ele aparece no painel.

### Banco: mesmo projeto ou um novo?
- O mais simples é usar o **mesmo** projeto Supabase do desenvolvimento.
- Para isolar produção, crie **outro** projeto Supabase, rode **todas** as migrations
  (`0001` a `0008`, em ordem) nele e use as chaves desse projeto nas variáveis da Vercel.

> 💡 **Free tier do Supabase pausa** o projeto após ~1 semana sem uso. Para um app em
> produção de verdade, considere o plano pago (ou mantenha o banco acordado com acessos regulares).

### Domínio próprio (opcional)
1. Vercel → **Settings → Domains** → adicione seu domínio e siga as instruções de DNS.
2. Atualize o **Site URL** e os **Redirect URLs** no Supabase para o novo domínio.

### Atualizações depois do deploy
Cada `git push` para o branch principal dispara um **redeploy automático** na Vercel.

---

## Roadmap
Veja [`ROADMAP.md`](ROADMAP.md) para o plano completo. **As 12 etapas estão concluídas**:
plataforma na nuvem, pedidos em tempo real, entregadores + rastreamento, IA (garçom virtual,
upsell, cadastro por foto, insights, tradução), planos, QR de mesa, avaliações, SEO e
super-admin. Pagamento é **100% presencial** na maquininha (crédito, débito e PIX) — sem gateway.
