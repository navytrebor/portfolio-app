# Frontend Phase Implementation Prompt

## Context

1. I am implementing a frontend step from my portfolio app plan.
2. Current goal: <phase/step, for example Phase 4 Step 2 Trade Registry UI>.
3. Backend exists with APIs for trades, valuation, and performance.
4. I need practical UX plus real integration, not placeholder-only UI.

## Execution Rules

1. Do not assume when multiple valid UI or architecture options exist.
2. Present options with pros and cons, then give a grounded recommendation.
3. Ask for confirmation before choosing among materially different options.
4. Implement end to end after confirmation.
5. Run validation (build or typecheck and a click-path smoke test).
6. Summarize exact files changed and test results.

## Required Decision Format

1. Option A
- Pros
- Cons
2. Option B
- Pros
- Cons
3. Recommendation
- Why this is best for current repo and phase scope

## Frontend-Specific Requirements

1. Connect to real backend APIs (no fake data unless explicitly requested).
2. Handle loading, empty, success, and error states.
3. Validate form input and show actionable error messages.
4. Include at least one deterministic manual test scenario.
5. Keep components modular and phase-appropriate (avoid overengineering).

## Delivery Format

1. What changed
- File list and purpose
2. UX behavior
- User flow and edge cases handled
3. API contract usage
- Endpoints used, payloads, and expected responses
4. Validation
- Commands run
- Runtime smoke path tested
- Result
5. Next step
- What should be implemented next in the plan

## Quick Version

Implement frontend plan step <X>.
Rules:
1. If multiple UI or data options exist, show pros and cons and recommend.
2. Ask before committing to a major option.
3. After confirmation, implement fully with real API integration.
4. Add loading, error, and empty states plus form validation.
5. Run build or typecheck plus one smoke user flow.
6. Summarize changed files, test results, and next step.
