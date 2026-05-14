# Portfolio App

Monorepo scaffold for a security trade registry, portfolio valuation, and performance analytics platform.

## Workspace Layout

- `apps/frontend` - React + TypeScript UI
- `apps/backend` - Fastify + TypeScript API
- `packages/contracts` - Shared domain and validation contracts
- `infra` - Local infrastructure orchestration
- `docs/adr` - Architecture Decision Records

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
   - pnpm --filter @portfolio/backend db:migrate
4. Run apps:
   - pnpm dev:backend
   - pnpm dev:frontend

## Secrets And Environment

- Environment templates are committed as .env.example files.
- Local .env files are ignored by git.
- Secret management rules are documented in docs/security/secrets-management.md.
