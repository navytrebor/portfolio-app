# ADR 0001: Modular Monolith as Initial Architecture

## Status
Accepted

## Context
The first release targets a small internal user base and needs fast feature delivery across trade registry, valuation, and performance analytics.

## Decision
Use a modular monolith for the backend with explicit domain modules:

- identity
- portfolio
- security-master
- trade-registry
- pricing-fx
- valuation
- performance

## Consequences

- Positive: faster delivery, simpler deployment, lower operational overhead.
- Positive: strong domain boundaries allow later extraction into services.
- Negative: scaling hotspots may require selective decomposition later.
