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
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=seu_segredo_forte
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
- `npm run build`: compila TypeScript para `dist`
- `npm run start`: inicia build de produção

## Rotas principais

- `POST /auth/login`
- `POST /auth/change-password`
- `GET /public/vouchers/:reservationCode`
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

## Estado atual

- Arquitetura administrativa organizada em `route -> controller -> service`
- Sem suíte de testes automatizados no momento
