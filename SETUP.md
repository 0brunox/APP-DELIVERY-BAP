# 🚀 Setup — Delivery Super App (Etapa 6)

Este projeto migrou de um único `index.html` (preservado em [`/legacy`](legacy/)) para
um app **Next.js + Supabase**. Siga os passos abaixo para rodar localmente.

## Pré-requisitos
- Node.js 18+ (você já tem)
- Uma conta gratuita no [Supabase](https://supabase.com)

## 1) Instalar dependências
```bash
npm install
```

## 2) Criar o projeto no Supabase
1. Acesse https://supabase.com e crie um projeto (free tier serve).
2. No menu lateral, abra **SQL Editor** → **New query**.
3. Cole todo o conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e clique **Run**.
   - Isso cria as tabelas, as políticas de segurança (RLS), as funções de pedido/cupom e o bucket de imagens.

## 3) Conectar o app ao Supabase
1. No Supabase, vá em **Project Settings → API**.
2. Copie a **Project URL** e a **anon public key**.
3. Na raiz do projeto, copie `.env.example` para `.env.local`:
   ```bash
   copy .env.example .env.local   # Windows
   # cp .env.example .env.local   # Mac/Linux
   ```
4. Cole os valores em `.env.local`.

## 4) Rodar
```bash
npm run dev
```
Abra http://localhost:3000

- A página inicial mostra o status da conexão.
- A loja pública fica em `http://localhost:3000/<slug-da-loja>` (ex.: `/sabor-express`).
- Sem `.env.local`, o app roda e mostra uma tela pedindo para conectar o Supabase.

## 5) Criar sua primeira loja (provisório até a sub-etapa 6D)
Enquanto o login do lojista (6D) não chega, crie uma loja de teste pelo SQL Editor.
Primeiro crie um usuário em **Authentication → Users → Add user**, copie o `id` dele e rode:

```sql
insert into public.stores (owner, slug, name, settings)
values (
  'COLE_O_UUID_DO_USUARIO',
  'sabor-express',
  'Sabor Express',
  '{"subtitle":"Delivery rápido e saboroso!","theme":{"primary":"#f59e0b","secondary":"#fbbf24","font":"Poppins"}}'
);
```

Depois, adicione um produto de exemplo (troque `STORE_ID` pelo id da loja criada):
```sql
insert into public.products (store_id, name, description, price, image, available)
values ('STORE_ID', 'Pizza Margherita', 'Molho, mussarela e manjericão', 42.90,
        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400', true);
```

Acesse `http://localhost:3000/sabor-express` e veja o cardápio lendo do banco. 🎉

## Próximas sub-etapas
- **6B** cardápio público completo (busca, categorias, detalhes)
- **6C** carrinho + checkout gravando pedido no banco + tela de confirmação
- **6D** login do lojista e painel `/admin`
- **6E** importar o backup JSON da Etapa 5
- **6F** upload de imagens para o Storage
- **6G** deploy na Vercel

## Roadmap geral
Veja [`ROADMAP.md`](ROADMAP.md) para o plano completo das 12 etapas.
