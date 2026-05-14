# Infrastructure

Local development services for the portfolio platform.

## Services

- PostgreSQL 16 on port 5432
- Redis 7 on port 6379

## Usage

- Start: `docker compose -f infra/docker-compose.yml up -d`
- Stop: `docker compose -f infra/docker-compose.yml down`
