# ADR 0002: PostgreSQL as System of Record

## Status
Accepted

## Context
Financial data requires strong consistency and auditability across trades, holdings, valuations, and performance snapshots.

## Decision
Use PostgreSQL as the primary database for ledger and derived state.

## Consequences

- Positive: ACID transactions support financial integrity.
- Positive: rich SQL supports reporting and snapshot queries.
- Negative: schema design and migrations must be managed carefully.
