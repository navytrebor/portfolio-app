# Portfolio App

Monorepo scaffold for a security trade registry, portfolio valuation, and performance analytics platform.

The backend API now exposes versioned endpoints under `/api/v1` with standardized pagination, filtering, and error responses.

## Workspace Layout

- `apps/frontend` - React + TypeScript UI
- `apps/backend` - Fastify + TypeScript API
- `packages/contracts` - Shared domain and validation contracts
- `infra` - Local infrastructure orchestration
- `docs/adr` - Architecture Decision Records
- `docs/backend-api.md` - Backend API contract and conventions

## Quick Start

1. Install pnpm 9+
2. Install dependencies:
   - pnpm install
3. Create local environment files:
   - cp .env.example .env
   - cp apps/backend/.env.example apps/backend/.env
   - cp apps/frontend/.env.example apps/frontend/.env
3. Start local infrastructure:
   - docker compose -f infra/docker-compose.yml up -d
4. Run database migrations:
   - AUTH_TOKEN_SECRET=local-dev-secret pnpm --filter @portfolio/backend db:migrate
5. Run apps:
   - pnpm dev:backend
   - pnpm dev:frontend

## Backend API Conventions

- Base path: `/api/v1`
- Authentication: `Authorization: Bearer <token>`
- Collection pagination: `limit` and `offset`
- Current collection filters:
  - `/api/v1/securities`: `ticker`, `currency`, `securityType`
  - `/api/v1/trades`: `portfolioId`
- Error envelope:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Portfolio access denied",
    "requestId": "req-123",
    "details": {}
  }
}
```

See `docs/backend-api.md` for examples and endpoint conventions.

## Validation Commands

- Backend typecheck: `pnpm --filter @portfolio/backend typecheck`
- Migration safety: `AUTH_TOKEN_SECRET=local-dev-secret pnpm --filter @portfolio/backend db:migrate`
- Authenticated API smoke: `AUTH_TOKEN_SECRET=local-dev-secret pnpm --filter @portfolio/backend api:smoke:auth`

## Secrets And Environment

- Environment templates are committed as .env.example files.
- Local .env files are ignored by git.
- Secret management rules are documented in docs/security/secrets-management.md.
