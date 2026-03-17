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
DATABASE_URL_APP=postgresql://app_runtime:pass@host:5432/db
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
OPENAI_API_KEY=sua_chave_da_openai
OPENAI_VOUCHER_ITINERARY_MODEL=gpt-5-mini
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
- Whitelist padrao inclui `https://vouchercard.com.br`, `https://www.vouchercard.com.br` e `https://admin.vouchercard.com.br`; mantenha `CORS_ALLOWED_ORIGINS` atualizado quando adicionar novos frontends
- `TRUST_PROXY=true` e recomendado quando a API fica atras de proxy/load balancer
- Os rate limits usam Postgres como contagem compartilhada e fazem fallback local apenas em falha do store
- `SUPERADMIN` so e reconhecido no login quando o email estiver em `SUPERADMIN_EMAILS`; criar usuario por agencia gera apenas `ADMIN`
- `ASAAS_API_URL`, `ASAAS_CHECKOUT_BASE_URL` e `FRONTEND_APP_URL` devem ser configuradas explicitamente antes do deploy
- `DATABASE_URL` fica reservado para migrações e fluxos de sistema (`signup`, `webhook`, rate limit, sweeper)
- `DATABASE_URL_APP` deve usar uma role sem `BYPASSRLS` para as rotas autenticadas do painel

Roteiro com IA:

- `OPENAI_API_KEY` habilita a geracao automatica do roteiro sugestao por voucher; sem ela, o voucher continua sendo criado normalmente, apenas sem roteiro salvo
- `OPENAI_VOUCHER_ITINERARY_MODEL` e opcional e por padrao usa `gpt-5-mini`

## Rollout de RLS

1. Crie a role de runtime usando [setup_app_runtime_role.sql](/c:/projetc_voucher/voucher-api/sql/setup_app_runtime_role.sql) e troque a senha antes de rodar.
2. Configure `DATABASE_URL_APP` no ambiente da API apontando para essa role.
3. Rode `npx prisma migrate deploy --config prisma.config.ts` para aplicar a migration [20260316193000_enable_tenant_rls](/c:/projetc_voucher/voucher-api/prisma/migrations/20260316193000_enable_tenant_rls/migration.sql).
4. Reinicie a API e confirme que o warning de `DATABASE_URL_APP nao configurada` sumiu.
5. Rode [verify_rls_runtime.sql](/c:/projetc_voucher/voucher-api/sql/verify_rls_runtime.sql) para confirmar a role e as policies.
6. Teste estes fluxos: `POST /auth/login`, `POST /auth/change-password`, CRUD de vouchers no admin, `GET /public/vouchers/:publicCode`, `POST /public/billing/signup`, `GET /public/billing/sessions/:publicToken` e `POST /webhooks/asaas`.

Checklist rapido depois do deploy:

- Admin da agencia consegue ver e alterar apenas a propria agencia.
- `SUPERADMIN` continua conseguindo listar agencias e operar multiagencia.
- Voucher publico continua abrindo quando a agencia esta ativa.
- Signup, webhook e sweep de expiracao continuam funcionando.

## Estado atual

- Arquitetura administrativa organizada em `route -> controller -> service`
- Suite automatizada de backend ativa para auth, escopo e regras de billing

