# 🚀 Roadmap — De site de delivery a Super App

> Projeto: **Sabor Express** (`index (1).html`) → Super app de delivery completo, moderno, fácil de configurar.
> Como usar: execute **uma etapa por sessão**. Copie o prompt da etapa, cole no Claude Code, teste o resultado e só então avance. As etapas 1–5 mantêm o app como **arquivo único** (continua vendável/distribuível sem servidor). A etapa 6 é o salto para plataforma na nuvem.

---

## 📋 Diagnóstico do app atual

**O que já existe:** landing page com status aberto/fechado por horário, cardápio com CRUD de produtos, carrinho lateral, dados do cliente, checkout via WhatsApp, painel admin protegido por senha (Ctrl+Shift+A), seletor de moeda, taxa de entrega única e exportação do HTML.

**Bugs críticos encontrados (corrigir antes de tudo — Etapa 1):**

1. **Exportar HTML perde os dados** — produtos e configurações vivem só no `localStorage`; o arquivo exportado contém o script com os `defaultProducts` originais. Aberto em outro navegador/máquina, a loja volta ao padrão. O recurso-chave de distribuição está quebrado.
2. **"Conversão automática" de moeda não existe** — trocar a moeda só troca o símbolo (R$ 42,90 vira $ 42,90), mas o admin promete conversão automática.
3. **XSS** — nome/descrição/imagem de produtos e dados do cliente são interpolados com `innerHTML` sem escape.
4. **Horário não suporta virada de meia-noite** — loja que abre 18:00 e fecha 02:00 aparece como fechada.

---

## 🗺️ Visão geral das etapas

| Fase | Etapa | Entrega |
|------|-------|---------|
| **A — Produto sólido** (arquivo único) | 1 | Fundação e correções críticas |
| | 2 | Cardápio profissional (categorias, variações, adicionais) |
| | 3 | Checkout completo (PIX, zonas, cupons, agendamento) |
| | 4 | Identidade visual, dark mode e PWA |
| | 5 | Painel do lojista 2.0 + gestão de pedidos |
| **B — Plataforma** (nuvem) | 6 | Migração para Next.js + Supabase + Vercel |
| | 7 | Pedidos em tempo real (painel + acompanhamento) |
| | 8 | Conta do cliente + fidelidade |
| | 9 | Pagamento online (PIX automático + cartão) |
| | 10 | Entregadores + rastreamento ao vivo |
| **C — Super app** | 11 | IA: garçom virtual, upsell, cardápio por foto |
| | 12 | Multi-lojas, QR de mesa, planos e crescimento |

---

## ETAPA 1 — Fundação e correções críticas

**Prompt:**

```
Renomeie "index (1).html" para index.html e inicie um repositório git neste projeto (com .gitignore e commit inicial). Depois corrija estes problemas, mantendo a arquitetura de arquivo único:

1) O botão "Exportar HTML" baixa o site com os produtos/configurações PADRÃO, porque os dados vivem só no localStorage. Faça a exportação embutir os produtos, configurações, moeda e horários atuais dentro do próprio HTML exportado, de modo que abrir o arquivo em outro navegador/máquina mostre a loja já configurada.
2) Todo conteúdo vindo do admin e do cliente (nome, descrição, endereço etc.) é inserido com innerHTML sem escape — crie um helper de escape e aplique em todos os pontos para impedir injeção de HTML.
3) O admin promete "conversão automática" de moeda mas só troca o símbolo. Implemente uma taxa de câmbio configurável manualmente no admin (BRL→USD e BRL→EUR) que converta os preços exibidos, deixando claro que a mensagem do WhatsApp sai sempre em R$.
4) Suporte horário que atravessa a meia-noite (ex.: abre 18:00, fecha 02:00).
5) Valide o número de WhatsApp (apenas dígitos, com DDI) e os preços nos formulários.

Ao final, me diga como testar cada correção manualmente.
```

**Critérios de aceite:** exportar → abrir em aba anônima mostra a loja configurada; inserir `<img onerror=alert(1)>` num nome de produto não executa; loja com horário 18:00–02:00 aparece aberta às 23h.

---

## ETAPA 2 — Cardápio profissional

**Prompt:**

```
Evolua o cardápio do index.html (mantendo arquivo único + localStorage):

- Categorias gerenciáveis no admin (criar, renomear, reordenar, ativar/desativar), com navegação por chips fixos no topo do cardápio e busca por nome de produto.
- Ao clicar num produto, abrir modal de detalhes com: foto grande, descrição completa, variações de tamanho com preços próprios (ex.: P/M/G), grupos de adicionais opcionais com preço e limites mín/máx (ex.: "escolha até 3"), campo de observações e seletor de quantidade.
- Preço promocional "de/por" e badges configuráveis (Novo, Mais vendido, Promoção, Vegetariano).
- O carrinho deve registrar variação + adicionais + observação de cada item, com preço calculado corretamente, e a mensagem do WhatsApp deve detalhar tudo isso por item.
- No admin, o cadastro de produto ganha: categoria, variações, grupos de adicionais e preço promocional.

Mantenha o design atual (Poppins, tons âmbar) e atualize a exportação de HTML para incluir os novos dados.
```

**Critérios de aceite:** pizza com tamanho G + 2 adicionais + observação aparece com preço certo no carrinho e detalhada na mensagem do WhatsApp.

---

## ETAPA 3 — Checkout completo

**Prompt:**

```
Implemente um checkout em etapas no carrinho do index.html (arquivo único + localStorage):

1) Tipo de pedido: Entrega, Retirada no local ou Consumo no local (com número da mesa).
2) Endereço com preenchimento automático por CEP usando a API pública ViaCEP, campos de número/complemento/referência. Taxa de entrega por bairro/zona configurável no admin (lista de bairros com taxa cada), além de pedido mínimo para entrega.
3) Formas de pagamento: PIX (chave configurável no admin + botão "copiar chave" + valor), cartão na entrega (maquininha) e dinheiro com cálculo de troco.
4) Cupons de desconto gerenciados no admin: percentual ou valor fixo, validade, valor mínimo do pedido e limite de usos.
5) Agendamento do pedido para mais tarde, respeitando os horários de funcionamento.

A mensagem final do WhatsApp deve sair organizada em seções (cliente, itens, pagamento, entrega, total). Salve os dados do cliente para a próxima compra e atualize a exportação de HTML.
```

**Critérios de aceite:** CEP válido preenche rua/bairro; bairro fora da lista mostra aviso; cupom expirado é recusado; pedido em dinheiro calcula troco.

---

## ETAPA 4 — Identidade visual, dark mode e PWA

**Prompt:**

```
Transforme o index.html em um app com cara de produto profissional:

- Editor de tema no admin: cor primária, cor secundária, fonte (3 opções do Google Fonts), imagem de banner do hero — com preview ao vivo enquanto edita.
- Dark mode automático (prefers-color-scheme) com toggle manual no header, persistido.
- Skeleton loading nas imagens, lazy loading, transições suaves, e bottom navigation no mobile (Início, Cardápio, Buscar, Carrinho).
- Acessibilidade: foco visível, aria-labels nos botões de ícone, contraste mínimo AA.
- PWA: gere manifest dinâmico com nome/cor/ícone da loja e um arquivo sw.js para cache offline do cardápio. Documente num comentário que instalação/offline funcionam quando hospedado (ex.: Vercel/Netlify/GitHub Pages) e que o uso local via arquivo continua funcionando normalmente.

Mantenha o arquivo único como fonte principal e atualize a exportação.
```

**Critérios de aceite:** trocar cor primária no admin muda todo o site na hora; dark mode persiste após recarregar; Lighthouse mobile ≥ 90 em acessibilidade.

---

## ETAPA 5 — Painel do lojista 2.0 + gestão de pedidos

**Prompt:**

```
Reformule o painel admin do index.html em abas: Pedidos, Cardápio, Configurações, Aparência e Relatórios.

- Ao finalizar um pedido, além de abrir o WhatsApp, registre-o no localStorage com número sequencial, itens, cliente, pagamento, taxa e status (Recebido → Em preparo → Saiu para entrega → Concluído / Cancelado).
- Aba Pedidos: lista do dia com cards por status, botões para avançar status, alerta sonoro quando chegar pedido novo na mesma máquina, e comanda imprimível (window.print com CSS dedicado de 80mm).
- Tela "Meus pedidos" para o cliente: acompanhar status e botão "repetir pedido".
- Aba Relatórios: vendas por dia/semana, itens mais vendidos e ticket médio, com gráficos simples (canvas ou SVG, sem libs externas).
- Backup completo: exportar/importar JSON com produtos, categorias, cupons, zonas, tema, configurações e pedidos.
- Wizard de primeira configuração (nome, WhatsApp, logo, cor, primeiro produto) exibido quando não houver dados salvos.
```

**Critérios de aceite:** fazer um pedido → ele aparece na aba Pedidos; importar o JSON num navegador limpo restaura a loja inteira; comanda imprime legível.

> ✅ **Marco:** ao fim da Etapa 5 você tem um produto completo e vendável para pequenos restaurantes, sem custo de servidor. Daqui em diante o app vira plataforma na nuvem.

---

## ETAPA 6 — Virar plataforma (Next.js + Supabase + Vercel)

**Prompt:**

```
Chegou a hora de tirar o app do localStorage e levar para a nuvem. Crie um projeto Next.js (App Router, TypeScript, Tailwind) nesta pasta e migre o app de delivery atual para ele, usando Supabase como backend (Postgres + Auth + Realtime + Storage):

- Modele as tabelas: stores, categories, products (variações/adicionais em JSONB), coupons, delivery_zones, orders, order_items e customers — com Row Level Security por loja.
- Cada loja tem um slug público (ex.: meuapp.vercel.app/sabor-express) com suas configurações e tema.
- Login do lojista com Supabase Auth (e-mail/senha) e painel admin como rota protegida (/admin).
- Recrie o cardápio público e o checkout completo que já temos no HTML (mesmo visual e funcionalidades das etapas 1–5), agora lendo do banco. O pedido é gravado no banco E a mensagem de WhatsApp continua sendo gerada como hoje.
- Ferramenta de migração: importar o JSON de backup da Etapa 5 para popular a loja.
- Upload de imagens de produtos para o Supabase Storage (em vez de URL externa).
- Prepare o deploy na Vercel: .env.example documentado e instruções passo a passo (criar projeto Supabase, rodar migrations SQL, configurar variáveis, deploy).

O arquivo index.html antigo fica preservado numa pasta /legacy.
```

**Critérios de aceite:** loja acessível pelo slug; pedido aparece na tabela orders; admin só vê os dados da própria loja; importação do JSON popula tudo.

---

## ETAPA 7 — Pedidos em tempo real

**Prompt:**

```
No projeto Next.js + Supabase, implemente o fluxo de pedidos em tempo real:

- Painel do lojista recebe pedidos novos instantaneamente (Supabase Realtime) com som de campainha, badge e destaque visual.
- Lojista aceita ou recusa com tempo estimado de preparo; cada mudança de status reflete ao vivo na tela do cliente, sem refresh.
- Página pública de acompanhamento por código do pedido (sem login): linha do tempo Recebido → Em preparo → Saiu para entrega → Entregue.
- Notificações Web Push no navegador para o lojista (novo pedido) e para o cliente (mudança de status), com permissão opcional.
- Modo cozinha (KDS): tela cheia com pedidos em colunas por status, fonte grande, arrastar para avançar.
- Botão de reimprimir comanda e atalho para chamar o cliente no WhatsApp.
```

**Critérios de aceite:** com duas janelas abertas (cliente e admin), o status muda ao vivo nas duas direções em menos de 2s.

---

## ETAPA 8 — Conta do cliente e fidelidade

**Prompt:**

```
Implemente a área do cliente no projeto Next.js + Supabase:

- Login simples por magic link de e-mail ou OTP por telefone (Supabase Auth), sem senha. Pedido sem login continua possível (guest).
- Perfil com endereços salvos (vários, com apelido "Casa"/"Trabalho"), forma de pagamento preferida e histórico de pedidos com botão "repetir pedido".
- Programa de fidelidade configurável pelo lojista: X pontos por real gasto, recompensas resgatáveis (produto grátis ou desconto), e exibição do saldo no app.
- Cupom de indicação: cliente compartilha link, e indicado + indicador ganham desconto na próxima compra.
- Cupons automáticos por gatilho: primeira compra, aniversário e cliente inativo há 30 dias.
```

**Critérios de aceite:** repetir pedido recria o carrinho com os mesmos itens; pontos creditados só após pedido Concluído; indicação gera cupom para os dois lados.

---

## ETAPA 9 — Pagamento online (PIX automático + cartão)

**Prompt:**

```
Integre pagamentos online com Mercado Pago no projeto Next.js + Supabase:

- PIX automático: no checkout, gerar QR code + copia-e-cola via API do Mercado Pago; confirmar pagamento por webhook e atualizar o status do pedido sozinho (pago/expirado).
- Cartão de crédito online com tokenização (Checkout Bricks/Transparente), sem dados de cartão tocando nosso servidor.
- Painel do lojista: campo para colar as credenciais do Mercado Pago da própria loja, escolher quais métodos ficam ativos.
- Pedido não pago em 15 minutos expira automaticamente e libera aviso ao cliente.
- Status de pagamento visível no painel do lojista e na tela de acompanhamento.
- Mantenha as opções offline (dinheiro com troco e maquininha na entrega).

Crie tudo com as credenciais em variáveis de ambiente/banco criptografado e webhooks validados por assinatura.
```

**Critérios de aceite:** pagamento PIX em sandbox muda o pedido para "Pago" sem ação manual; webhook com assinatura inválida é rejeitado.

---

## ETAPA 10 — Entregadores e rastreamento ao vivo

**Prompt:**

```
Crie o módulo de entregas no projeto Next.js + Supabase:

- Lojista cadastra entregadores (nome, telefone, login próprio com papel "courier").
- Tela mobile do entregador (PWA): lista de entregas atribuídas, botões "Peguei o pedido" e "Entregue", e compartilhamento de localização via Geolocation API enquanto a entrega está ativa.
- Mapa ao vivo (Leaflet + OpenStreetMap, sem chave paga) na tela de acompanhamento do cliente mostrando a posição do entregador e o destino.
- Atribuição de pedidos: manual pelo lojista nesta etapa, com estrutura pronta para atribuição automática depois.
- ETA estimado simples por distância em linha reta + tempo médio configurável.
- Histórico de entregas por entregador com soma de taxas para acerto semanal.
```

**Critérios de aceite:** posição do entregador atualiza no mapa do cliente a cada poucos segundos; encerrar entrega para o rastreamento.

---

## ETAPA 11 — IA: garçom virtual e inteligência

**Prompt:**

```
Adicione recursos de IA ao projeto usando a API da Anthropic (Claude), com as chaves apenas no servidor (route handlers), nunca no cliente:

1) "Garçom virtual": chat no app do cliente que entende linguagem natural ("monta um combo pra 2 pessoas até R$ 80, sem cebola") e monta o carrinho de verdade usando tool use com o cardápio real da loja (produtos, variações, adicionais, preços e disponibilidade).
2) Upsell inteligente: ao abrir o carrinho, sugerir 1–2 itens complementares baseados no pedido atual e nos itens mais pedidos juntos.
3) Cadastro por foto: o lojista fotografa o cardápio em papel e a IA extrai e pré-cadastra produtos (nome, descrição, preço, categoria) para revisão antes de salvar.
4) No painel do lojista: gerar descrições apetitosas para produtos, traduzir o cardápio para EN/ES, e um chat de insights que responde perguntas sobre as vendas reais ("qual foi meu melhor dia este mês?", "que item caiu de vendas?").

Inclua limites de uso por loja e tratamento de erro elegante quando a API estiver indisponível.
```

**Critérios de aceite:** o garçom virtual só adiciona itens que existem e respeita o orçamento pedido; foto de cardápio gera rascunhos editáveis, nunca publica direto.

---

## ETAPA 12 — Super app: multi-lojas, QR de mesa e crescimento

**Prompt:**

```
Feche o ciclo transformando o projeto em plataforma multi-lojas (white-label):

- Onboarding self-service: lojista cria conta, passa por um wizard (nome, logo, cores, WhatsApp, primeiro produto) e sai com a loja no ar no próprio slug. Suporte opcional a domínio próprio.
- Planos free/pro com limites (nº de produtos, pedidos/mês, recursos de IA) e cobrança recorrente via Mercado Pago assinaturas.
- QR code por mesa: gera PDF com QRs numerados; pedido feito pela mesa entra identificado e sem taxa de entrega. QR genérico do cardápio para vitrine/balcão.
- SEO por loja: metadata dinâmica, sitemap, OG image gerada com nome/logo da loja, página "link na bio".
- Avaliações de pedidos (nota + comentário) com moderação pelo lojista e selo de nota média na loja.
- Painel super-admin da plataforma (só para você): lojas ativas, pedidos totais, GMV, conversão de planos.
```

**Critérios de aceite:** criar loja nova do zero em menos de 5 minutos sem tocar em código; QR da mesa 7 gera pedido marcado "Mesa 7"; loja free é bloqueada com aviso amigável ao estourar limite.

---

## 💡 Ideias extras (backlog para depois)

- Pedido por voz no garçom virtual
- Bot de pedidos direto no WhatsApp (WhatsApp Business API)
- Atribuição automática de entregadores por proximidade
- Previsão de demanda e sugestão de estoque com IA
- App nativo via Capacitor (Play Store / App Store)
- Vitrine/marketplace agregando todas as lojas da plataforma por cidade
