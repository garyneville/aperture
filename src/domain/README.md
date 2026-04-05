# Domain Layer Primer

This folder contains the business logic for weather scoring and editorial generation. This is where weather data becomes photography recommendations.

## Purpose

- implement weather/photography decision logic independent of presentation
- score forecast conditions for photography quality
- generate editorial content from scored forecasts
- provide pure functions that transform data without side effects

## Public Entry Points

- [`scoring/`](./scoring/)
  - `score-all-days.ts` — Main scoring orchestrator
  - `features/derive-hour-features.ts` — Feature engineering for hour scoring
  - `sessions/index.ts` — Session recommendations and ranking

- [`editorial/`](./editorial/)
  - `prompt/build-prompt.ts` — Editorial prompt construction
  - `resolution/resolve-editorial.ts` — Editorial resolution with fallbacks

- [`windowing/`](./windowing/)
  - Window scheduling policy: time conversion, window classification, display planning, fallback text
  - Used by both domain (editorial resolution, validation) and presenters

- [`../contracts/`](../contracts/)
  Re-export surface for stable domain types:
  - `scored-forecast.ts` — `ScoredForecastContext`
  - `editorial.ts` — `EditorialDecision`, `BriefContext`
  - `session-score.ts` — `SessionScore`, `SessionRecommendationSummary`

## Main Files / Module Map

### Scoring (`scoring/`)

- `score-all-days.ts`
  Orchestrates hourly scoring, day summaries, and session recommendation attachment.

- `features/`
  Hour-level feature engineering, weather metric derivation, and post-frontal clarity detection (multi-hour lookback for wet-scavenged air windows).

- `sessions/`
  Built-in session evaluators (golden hour, blue hour, astro, etc.), cross-hour selection logic, and recommendation summary generation.

### Editorial (`editorial/`)

- `prompt/build-prompt.ts`
  Builds the AI provider prompt from scored forecast context.

- `prompt/sections/prompt-blocks.ts`
  Shared prompt block builders for response contracts, spur instructions, and week standout text.

- `resolution/resolve-editorial.ts`
  Orchestrates provider choice, response validation, fallback selection, and debug trace output.

- `resolution/parse.ts`
  Provider response parsing (JSON/text extraction).

- `resolution/validation.ts`
  Factual and stylistic quality checks on provider output.

- `resolution/composition.ts`
  Composition bullet filtering and normalization.

- `resolution/week-standout.ts`
  Week standout text generation.

- `resolution/spur-suggestion.ts`
  Spur-of-the-moment suggestion logic.

## Data Flow

```
Raw Forecast Data
       ↓
[features/derive-hour-features] → Hour-level features
       ↓
[scoring/score-all-days] → ScoredForecastContext (windows, daily summaries, sessions)
       ↓
[editorial/prompt/build-prompt] → EditorialRequest (prompt + context)
       ↓
[editorial/resolution/resolve-editorial] → EditorialDecision (AI text, bullets, week insight)
```

## What Belongs Here

- Weather scoring algorithms and heuristics
- Session recommendation logic (ranking, timing, quality thresholds)
- Editorial prompt construction and AI response handling
- Validation and fallback logic for editorial content
- Pure business logic with no knowledge of n8n, email formatting, or HTTP clients

## What Does Not Belong Here

- **HTTP/API calls** — belongs in adapters
- **Email/HTML formatting** — belongs in presenters
- **n8n-specific code** — belongs in `src/adapters/n8n`
- **Orchestration/sequencing** — belongs in `src/app`
- **Shared utilities** — belongs in `src/lib`

## Dependency Rule

**Domain must not import from Presenters.** If you find yourself wanting to import from `src/presenters/`, that code probably belongs in `src/domain/` itself (as a shared module like `windowing/`) or in `src/lib/`.

This rule prevents domain logic from becoming coupled to presentation concerns and keeps the business logic independent of how results are formatted.

## Tests

Each submodule has co-located tests:

- `scoring/`
  - `score-all-days.test.ts`
  - `features/derive-hour-features.test.ts`
  - `sessions/index.test.ts`

- `editorial/`
  - `prompt/build-prompt.test.ts`
  - (Additional coverage via `../../adapters/n8n/format-messages.adapter.test.ts`)

## Working Rule

Domain code should be pure and testable in isolation. It receives data, transforms it, and returns new data. No side effects, no direct I/O, no knowledge of how the results will be presented. If you need to add a new scoring rule or editorial fallback, it belongs here.

## Related Docs

- [`./scoring/README.md`](./scoring/README.md) — Detailed scoring documentation
- [`./editorial/README.md`](./editorial/README.md) — Detailed editorial documentation
- [`../app/run-photo-brief/README.md`](../app/run-photo-brief/README.md) — How the app layer orchestrates domain logic
- [`../contracts/README.md`](../contracts/README.md) — Public contract surface for domain types
- [`../lib/README.md`](../lib/README.md) — Shared utilities used by domain code
