# ADR 0003: Local-First Deployment Model

## Status
Accepted

## Context
The initial team needs rapid iteration with minimal platform dependencies.

## Decision
Start with local-first orchestration using Docker Compose for required services and keep deployment interfaces cloud-neutral.

## Consequences

- Positive: lower startup friction for development.
- Positive: reproducible environment for onboarding.
- Negative: production hardening work is deferred to later phases.
