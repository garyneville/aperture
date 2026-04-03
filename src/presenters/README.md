# Presenter Layer Primer

This folder contains all output formatting logic. Presenters transform structured brief data into presentation formats: email HTML, site HTML, Telegram messages, and machine-readable JSON.

## Purpose

- turn structured brief data into presentation-ready output
- isolate formatting concerns from business logic
- support multiple output formats from the same underlying data
- provide consistent styling and layout across channels

## Public Entry Points

- [`email/index.ts`](./email/index.ts)
  Email HTML rendering and debug email output.

- [`site/format-site.ts`](./site/format-site.ts)
  Static site HTML rendering.

- [`telegram/format-telegram.ts`](./telegram/format-telegram.ts)
  Telegram message formatting.

- [`brief-json/render-brief-json.ts`](./brief-json/render-brief-json.ts)
  Canonical machine-readable brief output.

- [`shared/brief-primitives.ts`](./shared/brief-primitives.ts)
  Cross-presenter render primitives (colors, icons, stat helpers).

## Main Files / Module Map

### Email (`email/`)

- `index.ts` — Public entry point for email rendering
- `shared.ts` — Cross-cutting render helpers
- `time-aware.ts` — Rerun-aware window display logic
- `kit-advisory.ts` — Rule-based kit recommendation logic
- `next-day.ts` — Outdoor comfort scoring and forecast tables
- `debug-email.ts` — Internal debug email rendering
- `format-email.test.ts`, `debug-email.test.ts`, etc. — Tests

### Site (`site/`)

- `format-site.ts` — Main site formatter, assembles sections into complete page
- `site-layout.ts` — HTML document wrapper and layout
- `sections/` — Modular section components:
  - `hero.ts` — Hero score card
  - `signals.ts` — Signal indicator cards (aurora, moon, etc.)
  - `window.ts` — Shooting window display
  - `daylight-utility.ts` — Daylight utility bar
  - `session-rec.ts` — Session recommendation card
  - `creative-spark.ts` — Creative spark/AI text section
  - `kit-advisory.ts` — Kit advisory card
  - `alternatives.ts` — Alternative locations section
  - `long-range.ts` — Long-range destination section
  - `hourly-outlook.ts` — Hour-by-hour outlook
  - `forecast.ts` — Photo forecast and car wash cards
  - `spur-of-moment.ts` — Spur-of-the-moment suggestion
  - `footer.ts` — Footer key/legend
  - `shared.ts` — Shared section utilities

### Telegram (`telegram/`)

- `format-telegram.ts` — Telegram message formatter with HTML tags

### Brief JSON (`brief-json/`)

- `render-brief-json.ts` — Machine-readable JSON output renderer
- `render-brief-json.test.ts` — Tests

### Shared (`shared/`)

- `brief-primitives.ts` — Cross-presenter primitives: colors, typography, icons, stat grids, weather/moon icons
- `window-helpers.ts` — Cross-presenter window and session display utilities (session names, window labels, summaries)
- `kit-advisory.ts` — Cross-presenter kit recommendation logic

## Data In / Data Out

**Input:**
All presenters receive `BriefRenderInput` (from [`../types/brief.ts`](../types/brief.ts)), which includes:
- Scored windows and daily summaries
- AI-generated editorial content
- Session recommendations
- Alternative locations and long-range destinations
- Debug context for optional debug output

**Output:**
- **Email:** HTML string (email-compatible markup)
- **Site:** Complete HTML document string
- **Telegram:** HTML-formatted message string (Telegram HTML subset)
- **Brief JSON:** Structured JSON object matching `BriefJson` contract

## What Belongs Here

- Formatting and layout logic
- HTML/markup generation
- Presentation-specific styling decisions
- Channel-specific output constraints (email client limits, Telegram HTML tags)
- Icon rendering and color schemes

## What Does Not Belong Here

- **Business logic** — belongs in `src/domain` (scoring rules, editorial decisions)
- **Weather calculations** — belongs in `src/domain/scoring` or `src/lib`
- **Orchestration** — belongs in `src/app`
- **HTTP/API calls** — belongs in adapters
- **External configuration** — belongs in adapters or config

## Tests

- `email/format-email.test.ts`
- `email/debug-email.test.ts`
- `email/kit-advisory.test.ts`
- `email/next-day.test.ts`
- `site/format-site.test.ts`
- `brief-json/render-brief-json.test.ts`

## Working Rule

Presenters should be pure functions from data to formatted output. They should not fetch data or make decisions about what data to include—that's the domain layer's job. If the same logic is needed across multiple presenters (e.g., color constants, icon rendering), extract it to `shared/`. If formatting logic becomes complex enough to have its own internal modules (like site sections), organize it into subdirectories.

## Related Docs

- [`./email/README.md`](./email/README.md) — Email presenter details
- [`./site/README.md`](./site/README.md) — Site presenter details
- [`./telegram/README.md`](./telegram/README.md) — Telegram presenter details
- [`./brief-json/README.md`](./brief-json/README.md) — Brief JSON details
- [`./shared/README.md`](./shared/README.md) — Shared primitives details
- [`../domain/README.md`](../domain/README.md) — Domain layer that feeds presenters
- [`../types/brief.ts`](../types/brief.ts) — Input type for all presenters
