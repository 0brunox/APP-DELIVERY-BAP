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
3. Cole todo o conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e clique **Run**.
   - Cria as tabelas, as políticas de segurança (RLS), as funções de pedido/cupom
     (`place_order`, `validate_coupon`, `get_order_by_code`), o bucket de imagens
     `product-images` e habilita o realtime na tabela `orders`.

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

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | a sua Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a sua chave pública |

> Não precisa de `NEXT_TELEMETRY_DISABLED` — aquilo é só um contorno do ambiente local (Windows/OneDrive).

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
- Para isolar produção, crie **outro** projeto Supabase, rode o `0001_init.sql` nele e use as
  chaves desse projeto nas variáveis da Vercel.

### Domínio próprio (opcional)
1. Vercel → **Settings → Domains** → adicione seu domínio e siga as instruções de DNS.
2. Atualize o **Site URL** e os **Redirect URLs** no Supabase para o novo domínio.

### Atualizações depois do deploy
Cada `git push` para o branch principal dispara um **redeploy automático** na Vercel.

---

## Roadmap
Veja [`ROADMAP.md`](ROADMAP.md) para o plano completo das 12 etapas.
A **Etapa 6** (virar plataforma na nuvem) está concluída. A seguir: **Etapa 7 — pedidos em tempo real**.
