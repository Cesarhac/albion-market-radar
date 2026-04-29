# Albion Market Radar

Albion Market Radar é uma aplicação em **Next.js**, **TypeScript**, **Tailwind CSS** e **Supabase** para jogadores de Albion Online buscarem preços, encontrarem oportunidades, controlarem carteira de trader, anunciarem Armas .4 e conversarem no chat.

O site não vende prata, não vende itens por dinheiro real, não vende contas e não intermedia negociações. As ferramentas apenas organizam dados e anúncios informativos.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth e Postgres
- Supabase Realtime preparado para o chat
- Lucide React
- Route Handlers internos para integração com Albion Online Data Project

## Variáveis de ambiente

Crie `.env.local` a partir de `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como chave pública principal. `NEXT_PUBLIC_SUPABASE_ANON_KEY` é aceito como fallback para compatibilidade.

Não é necessário `SUPABASE_SERVICE_ROLE_KEY` nesta etapa. O projeto não usa `service_role` no frontend nem no build.

## Banco Supabase

A migration inicial está em:

```txt
supabase/migrations/20260429000000_initial_schema.sql
```

Ela cria:

- `profiles`
- `user_settings`
- `trader_operations`
- `favorites`
- `weapon_listings`
- `chat_messages`
- `price_alerts`

Todas as tabelas têm Row Level Security. Dados privados são limitados por `auth.uid()`. Anúncios de Armas .4 e mensagens visíveis do chat podem ser lidos por usuários autenticados.

## Como rodar localmente

Pré-requisito: Node.js 20.9 ou superior.

1. Crie o projeto no Supabase.
2. Configure `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Rode a migration SQL no Supabase SQL Editor ou via Supabase CLI.
4. Instale dependências:

```bash
npm install
```

5. Rode o projeto:

```bash
npm run dev
```

6. Abra `http://localhost:3000`.
7. Teste `/register`, faça login e acesse `/profile`.

## Publicação gratuita na Vercel

1. Envie o repositório para o GitHub.
2. Importe o projeto na Vercel.
3. Configure as variáveis:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

4. Use as configurações padrão para Next.js.
5. Faça deploy.
6. No Supabase, configure a URL do site em Auth para redirects de login/cadastro quando necessário.

## Scripts

- `npm run dev`: inicia o ambiente local.
- `npm run lint`: roda ESLint no projeto.
- `npm exec tsc -- --noEmit`: valida TypeScript.
- `npm run build`: gera o build de produção do Next.js.
- `npm run start`: serve o build de produção após `npm run build`.

## Recursos

- Auth real com Supabase.
- Cadastro, login, logout e perfil.
- Proteção client-side das ferramentas principais.
- Configurações por usuário no Supabase.
- Carteira do Trader em `trader_operations`.
- Favoritos em `favorites`.
- Armas .4 e despertadas em `weapon_listings`.
- Chat em `chat_messages`, com assinatura realtime preparada.
- Plano Free/Pro estruturado, sem checkout e sem Stripe nesta etapa.

## Dados de mercado

A página **Buscar preços** consulta preços reais pelo Albion Online Data Project usando a rota interna:

```txt
/api/market/prices?itemId=T4_BAG&server=americas&qualities=1
/api/market/prices?itemId=T4_BAG&server=europe&qualities=1
```

A página **Oportunidades** calcula arbitragem com lista inicial de itens monitorados usando:

```txt
/api/market/opportunities?server=americas&qualities=1&taxRate=0.065
/api/market/opportunities?server=europe&qualities=1&taxRate=0.065
```

Servidores suportados: **Américas** (`west.albion-online-data.com`) e **Europa** (`europe.albion-online-data.com`). Cada consulta usa apenas o servidor selecionado, sem cruzar economias.

## Segurança e RMT

O Albion Market Radar:

- não pede senha do Albion Online;
- não é afiliado à Sandbox Interactive;
- não vende prata;
- não vende itens por dinheiro real;
- não vende contas;
- não intermedia pagamentos, trocas ou entregas;
- não garante negociações entre jogadores.

Negociações e anúncios devem seguir as regras do Albion Online.
