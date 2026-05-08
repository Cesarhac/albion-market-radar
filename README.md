# Albion Market Radar

Albion Market Radar é uma aplicação em **Next.js App Router**, **TypeScript**, **Tailwind CSS**, **Supabase Auth/Postgres/RLS** e **Stripe** para jogadores de Albion Online buscarem preços, encontrarem oportunidades, controlarem carteira de trader, anunciarem Armas .4 e configurarem Alertas de Preço.

O site não vende prata, itens, contas ou vantagens dentro do jogo. As ferramentas apenas organizam dados públicos e anúncios informativos para negociação direta entre jogadores.

## Variáveis De Ambiente

Crie `.env.local` a partir de `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` e `STRIPE_SECRET_KEY` são usados somente em Route Handlers server-side. Nunca exponha essas chaves em Client Components.

## Supabase

1. Crie o projeto no Supabase.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Rode as migrations em `supabase/migrations`.
4. Confirme que as tabelas principais existem: `profiles`, `user_settings`, `trader_operations`, `weapon_listings`, `chat_messages`, `price_alerts`, `saved_filters` e `saved_regear_builds`.
5. Garanta que RLS está ativa. Dados privados usam `auth.uid()`. Anúncios de Armas .4 podem ser lidos por usuários autenticados, mas só o dono pode inserir, editar ou excluir.

## Stripe Local

1. Crie um produto no Stripe em modo teste.
2. Crie o preço recorrente mensal **R$ 10,00**.
3. Copie o `price_...` para `NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY`.
4. Configure `STRIPE_SECRET_KEY`.
5. Rode:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

6. Copie o `whsec_...` para `STRIPE_WEBHOOK_SECRET`.
7. Reinicie `npm run dev`.
8. Teste com o cartão:

```txt
4242 4242 4242 4242
```

O usuário só vira PRO após confirmação do webhook. O frontend nunca altera `plan` ou `subscription_status`.

## Rodar Localmente

Pré-requisito: Node.js 20.9 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`, cadastre uma conta, faça login e teste `/search`, `/pro`, `/opportunities`, `/alerts`, `/weapons`, `/trader`, `/regear` e `/chat`.

## Deploy Na Vercel

1. Envie o repositório para o GitHub.
2. Importe o projeto na Vercel.
3. Configure as variáveis:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY
NEXT_PUBLIC_APP_URL
```

Em produção:

```txt
NEXT_PUBLIC_APP_URL=https://sua-url-da-vercel.vercel.app
```

4. Adicione a URL da Vercel no Supabase Auth.
5. No Stripe Dashboard, crie webhook de produção:

```txt
https://sua-url-da-vercel.vercel.app/api/stripe/webhook
```

Eventos:

```txt
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

## Plano PRO

PRO mensal: **R$ 10/mês** via assinatura recorrente Stripe Checkout.

Recursos PRO:

- Radar de Oportunidades exclusivo.
- Alertas de Preço.
- Mais itens analisados.
- Filtros avançados.
- Exportação CSV.
- Carteira ilimitada.
- Relatórios de lucro.
- Regear salvo.
- 20 anúncios de Armas .4.

Status com acesso temporário: `active`, `trialing` e `past_due`, desde que `subscription_current_period_end` não esteja vencido quando existir. Status como `canceled`, `unpaid`, `incomplete_expired`, `inactive` e `free` bloqueiam recursos PRO.

## Alertas

Alertas de Preço são PRO. Eles são verificados ao abrir `/alerts`, ao clicar em **Verificar agora** e automaticamente enquanto o site estiver aberto.

As notificações do navegador funcionam enquanto o site estiver aberto. Alertas em segundo plano, Discord e e-mail serão adicionados futuramente.

## Segurança

- `/opportunities` e `/alerts` são PRO-only.
- `/api/market/opportunities` valida usuário e plano antes de consultar o radar real.
- Armas .4: apenas o criador do anúncio pode editar, excluir, marcar como vendido ou reservar.
- RLS impede update/delete de `weapon_listings` por usuário que não seja dono.
- Favoritos foram substituídos por Alertas; `/favorites` redireciona para `/alerts`.

## Scripts

```bash
npm run lint
npm exec tsc -- --noEmit
npm run build
npm run sync:items
npm run validate:items
```

Antes de publicar, rode `npm run lint`, `npm exec tsc -- --noEmit` e `npm run build`.
