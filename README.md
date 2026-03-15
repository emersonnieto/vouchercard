# Voucher API

API backend do SaaS `project_voucher`, responsável por autenticação, gestão administrativa multiagência e consulta pública de vouchers.

## Stack

- Node.js + TypeScript
- Express 5
- Prisma + PostgreSQL
- JWT + bcrypt

## Estrutura

```text
src/
  auth/
  lib/
  middlewares/
  modules/
    admin/
      admin.controller.ts
      admin.service.ts
  routes/
    auth.ts
    admin.ts
    public.ts
  server.ts
```

## Pré-requisitos

- Node.js 20+
- PostgreSQL acessível pela `DATABASE_URL`

## Configuração

1. Instale dependências:

```bash
npm install
```

2. Configure variáveis de ambiente em `.env`:

```env
NODE_ENV=development
PORT=3333
DATABASE_URL=postgresql://user:pass@host:5432/db
DATABASE_SSL=
DATABASE_SSL_REJECT_UNAUTHORIZED=
JWT_SECRET=seu_segredo_forte
SUPERADMIN_EMAILS=owner@seudominio.com,ops@seudominio.com
CORS_ALLOWED_ORIGINS=https://admin.seudominio.com,https://app.seudominio.com
TRUST_PROXY=true
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=10
PUBLIC_VOUCHER_RATE_LIMIT_WINDOW_MS=300000
PUBLIC_VOUCHER_RATE_LIMIT_MAX=60
SIGNUP_RATE_LIMIT_WINDOW_MS=3600000
SIGNUP_RATE_LIMIT_MAX=10
SUBSCRIPTION_EXPIRATION_SWEEP_MS=900000
ASAAS_API_URL=https://api-sandbox.asaas.com/v3
ASAAS_API_KEY=seu_token_do_asaas
ASAAS_CHECKOUT_BASE_URL=https://sandbox.asaas.com/checkoutSession/show/
ASAAS_WEBHOOK_TOKEN=seu_token_de_webhook
FRONTEND_APP_URL=http://localhost:5173
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=seu_service_role
```

3. Gere client Prisma:

```bash
npx prisma generate --config prisma.config.ts
```

4. Execute migrações:

```bash
npx prisma migrate deploy --config prisma.config.ts
```

5. Suba a API em desenvolvimento:

```bash
npm run dev
```

## Scripts

- `npm run dev`: roda API com `ts-node-dev`
- `npm run typecheck`: valida TypeScript sem gerar build
- `npm run build`: compila TypeScript para `dist`
- `npm run start`: inicia build de produção
- `npm run test`: executa a suíte automatizada do backend
- `npm run ci`: gate local de release (`build + test`)
- `npm run prisma:status`: confere o estado das migrações no banco configurado

## Rotas principais

- `POST /auth/login`
- `POST /auth/change-password`
- `GET /public/vouchers/:publicCode`
- `GET /admin/me`
- `GET /admin/agencies`
- `POST /admin/agencies`
- `PATCH /admin/agencies/:agencyId/status`
- `PATCH /admin/agencies/:agencyId/branding`
- `POST /admin/agencies/:agencyId/users`
- `POST /admin/vouchers`
- `GET /admin/vouchers`
- `GET /admin/vouchers/:id`

## Deploy e operação

- Defina `NODE_ENV=production`
- Rode migrações antes de liberar tráfego
- Monitore `GET /health`
- Não versionar `.env`

- Em producao, configure `CORS_ALLOWED_ORIGINS` para ativar whitelist; sem ela, a API sobe com warning e libera todas as origens
- Whitelist padrao inclui `https://admin.vouchercard.com.br` e `https://vouchercard-admin.vercel.app`; mantenha `CORS_ALLOWED_ORIGINS` atualizado quando adicionar novos frontends
- `TRUST_PROXY=true` e recomendado quando a API fica atras de proxy/load balancer
- Os rate limits usam Postgres como contagem compartilhada e fazem fallback local apenas em falha do store
- `SUPERADMIN` so e reconhecido no login quando o email estiver em `SUPERADMIN_EMAILS`; criar usuario por agencia gera apenas `ADMIN`
- `ASAAS_API_URL`, `ASAAS_CHECKOUT_BASE_URL` e `FRONTEND_APP_URL` devem ser configuradas explicitamente antes do deploy

## Estado atual

- Arquitetura administrativa organizada em `route -> controller -> service`
- Suite automatizada de backend ativa para auth, escopo e regras de billing

