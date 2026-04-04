# Scoring Primer

This folder owns weather feature derivation, day scoring, and session recommendations.

## Purpose

- derive scoring features from hourly forecast input
- score each hour and summarize each day
- rank built-in photography sessions across the forecast window

## Public entrypoints

- [`score-all-days.ts`](./score-all-days.ts)
  Main scoring orchestrator for hourly and daily outputs.
- [`features/derive-hour-features.ts`](./features/derive-hour-features.ts)
  Shared derived-feature seam used by the session evaluators.
- [`sessions/index.ts`](./sessions/index.ts)
  Built-in session evaluators, cross-hour selection, and recommendation summary.
- [`../../contracts/scored-forecast.ts`](../../contracts/scored-forecast.ts)
  Shared scored-forecast contract surface for callers.

## Working structure

- `features/`
  Hour-level feature engineering.
- `sessions/`
  Session evaluation and recommendation logic.
- `score-all-days.ts`
  Orchestrates hourly scoring, day summaries, debug payload assembly, and session recommendation attachment.

## Defensive guards

- `summarize-day.ts` guards `crepRayPeak` against empty `hours` arrays (`Math.max(0, ...)` floor).
- `features/derive-hour-features.ts` guards `sweetSpotScore` against division-by-zero when `idealMin === hardMin` or `idealMax === hardMax`.

## What not to edit casually

- the scoring math in [`score-all-days.ts`](./score-all-days.ts) without corresponding fixture or unit coverage
- the built-in session ranking order in [`sessions/index.ts`](./sessions/index.ts) without checking downstream presentation assumptions
- debug payload shape in [`../../lib/debug-context.ts`](../../lib/debug-context.ts), because email/debug tooling depends on it

## Tests

- [`score-all-days.test.ts`](./score-all-days.test.ts)
- [`features/derive-hour-features.test.ts`](./features/derive-hour-features.test.ts)
- [`sessions/index.test.ts`](./sessions/index.test.ts)
