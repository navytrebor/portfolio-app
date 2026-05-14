# AI Prompts Index

## Purpose

Reusable prompts for phase-based implementation in this repository.

## Files

1. `backend-phase-implementation.md`
- Use for backend-focused plan steps (schema, migrations, seeding, APIs, module boundaries).
- Emphasizes option analysis, grounded recommendations, migration safety, and smoke validation.

2. `frontend-phase-implementation.md`
- Use for frontend-focused plan steps (forms, screens, UX states, API integration).
- Emphasizes option analysis, real API usage, validation states, and click-path smoke tests.

## Recommended Workflow

1. Pick the file matching your phase scope.
2. Copy the full prompt into a new chat.
3. Replace placeholders such as `<phase and step>`.
4. Keep branch and validation outputs in the response.

## Quick Rule

- If the step is mostly data model/API/backend infrastructure: use `backend-phase-implementation.md`.
- If the step is mostly UI behavior/user flow/API consumption: use `frontend-phase-implementation.md`.
