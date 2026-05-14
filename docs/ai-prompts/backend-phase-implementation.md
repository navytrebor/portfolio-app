# Backend Phase Implementation Prompt

## Context

1. I am implementing one step from my portfolio app plan.
2. Current goal: <phase and step>.
3. Branch strategy: one feature branch per plan step.
4. Stack: TypeScript backend, PostgreSQL, migration scripts, seed generators.

## Execution Rules

1. Do not assume when multiple valid options exist.
2. For each important decision, present options with pros and cons.
3. Give a grounded recommendation based on current repo state.
4. Ask for confirmation before implementing when options materially affect design.
5. Implement end to end once decision is confirmed.
6. Run validation commands and summarize real outputs.

## Required Delivery Format

### A. Decision Section

1. Option A
- Pros
- Cons
2. Option B
- Pros
- Cons
3. Recommendation
- Why this is best now for this repo

### B. Implementation Section

1. Files changed
2. What each change does
3. Why this preserves module boundaries and future extensibility

### C. Validation Section

1. Commands run
2. Actual results
3. Any failures and fixes applied

### D. Handoff Section

1. What is complete for this step
2. What remains for next step
3. Safe next command sequence

## Step-Specific Add-On For Phase 2 And 3

1. Always include migration safety checks.
2. For seed work, provide upsert and reset modes.
3. For synthetic data, require deterministic seed and scale profiles.
4. For API work, include one smoke use case with expected response.
5. Keep local branch synchronized with remote PR branch before final summary.

## Quick Version

Implement plan step <X>.
Rules:
1. Do not assume when there are multiple options.
2. Show options with pros and cons, then recommend.
3. After confirmation, implement fully.
4. Run typecheck plus one runtime smoke test.
5. Summarize files changed, commands run, and next step.
