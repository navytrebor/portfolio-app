# Backend API

## Overview

The backend is a Fastify API exposed under the versioned base path `/api/v1`.

Current goals of the HTTP contract:

- make version changes explicit
- keep collection behavior consistent across modules
- provide a uniform error envelope for frontend and operational tooling

## Authentication

- Protected endpoints require `Authorization: Bearer <token>`.
- Tokens are signed by the backend using `AUTH_TOKEN_SECRET`.
- Role checks are enforced per endpoint.

Common auth-related error codes:

- `AUTHENTICATION_REQUIRED`
- `FORBIDDEN`

## Versioning Strategy

- Versioning is path-based.
- Current stable prefix: `/api/v1`
- Future breaking API changes should be introduced under a new prefix such as `/api/v2` instead of mutating `v1` behavior in place.

## Pagination Standard

Collection endpoints use offset pagination.

Supported query parameters:

- `limit`: integer from 1 to 100, default `50`
- `offset`: integer `>= 0`, default `0`

Paginated responses use this shape:

```json
{
  "items": [],
  "page": {
    "limit": 50,
    "offset": 0,
    "total": 3,
    "returned": 3,
    "hasMore": false
  }
}
```

## Filtering Standard

Filters are route-specific exact-match query parameters.

Current collection filters:

- `GET /api/v1/securities`
  - `ticker`
  - `currency`
  - `securityType`
- `GET /api/v1/trades`
  - `portfolioId`

Filtering is applied before pagination metadata is calculated.

## Error Taxonomy

All handled API errors return a single envelope:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid trade payload",
    "requestId": "req-abc123",
    "details": []
  }
}
```

Fields:

- `code`: stable machine-readable error code
- `message`: human-readable summary
- `requestId`: Fastify request identifier for tracing
- `details`: optional structured payload, typically validation issues

Current error codes:

- `AUTHENTICATION_REQUIRED` -> 401
- `FORBIDDEN` -> 403
- `INVALID_REQUEST` -> 400
- `NOT_FOUND` -> 404
- `CONFLICT` -> 409
- `INTERNAL_ERROR` -> 500

## Current Endpoint Surface

### Portfolios

- `GET /api/v1/portfolios`
- Auth: role policy for portfolio read
- Query: `limit`, `offset`
- Response: paginated portfolio collection

### Securities

- `GET /api/v1/securities`
- Auth: role policy for security read
- Query: `limit`, `offset`, optional `ticker`, `currency`, `securityType`
- Response: paginated security collection

- `GET /api/v1/securities/:securityId`
- Auth: role policy for security read
- Response: security document or `NOT_FOUND`

### Trades

- `GET /api/v1/trades`
- Auth: role policy for trade read
- Query: `limit`, `offset`, optional `portfolioId`
- Response: paginated trade collection scoped by role

- `POST /api/v1/trades`
- Auth: role policy for trade write
- Headers: optional `x-idempotency-key`
- Response: created trade or `CONFLICT` on idempotency violations

### Valuation

- `POST /api/v1/valuations/run`
- Auth: role policy for valuation execution
- Body:

```json
{
  "portfolioId": "11111111-1111-1111-1111-111111111111",
  "asOf": "2026-12-31T17:00:00.000Z"
}
```

### Performance Analytics

- `POST /api/v1/analytics/performance/run`
- Auth: role policy for analytics execution
- Body:

```json
{
  "portfolioId": "11111111-1111-1111-1111-111111111111",
  "asOf": "2026-12-31T17:00:00.000Z"
}
```

## Local Validation

Use these commands when changing backend API behavior:

```bash
docker compose -f infra/docker-compose.yml up -d
AUTH_TOKEN_SECRET=local-dev-secret pnpm --filter @portfolio/backend db:migrate
AUTH_TOKEN_SECRET=local-dev-secret pnpm --filter @portfolio/backend dev
AUTH_TOKEN_SECRET=local-dev-secret pnpm --filter @portfolio/backend api:smoke:auth
```

The authenticated smoke test validates:

- versioned route access under `/api/v1`
- paginated list responses
- security and trade filters
- valuation and analytics command routes
- forbidden write behavior for insufficient roles