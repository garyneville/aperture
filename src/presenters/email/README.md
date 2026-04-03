# Format Email Primer

This folder holds the photo brief email formatter.

The public entrypoint is [`index.ts`](./index.ts).

`index.ts` now consumes the shared derived presenter context from
[`../shared/presenter-context.ts`](../shared/presenter-context.ts) before
assembling email-specific markup.

## Module map

- [`types.ts`](./types.ts)
  Local re-export of the canonical brief render contracts from [`../../types/brief.ts`](../../types/brief.ts).

- [`shared.ts`](./shared.ts)
  Cross-cutting render helpers and shared presentation primitives: colors, typography, cards, pills, stat grids, weather/moon icons, and a few general formatting helpers.

- [`time-aware.ts`](./time-aware.ts)
  Email-only orchestration for the "today's window" card. It classifies local windows as past/current/future, applies the "next window" promotion, and assembles the rendered section.
  Card rendering lives in [`window-cards.ts`](./window-cards.ts) and general-purpose window/session helpers live in [`../shared/window-helpers.ts`](../shared/window-helpers.ts).

- [`window-cards.ts`](./window-cards.ts)
  Email-specific window card rendering. Contains `windowCard()` for rendering individual photography windows, `compositionCard()` for shot ideas, and `poorDayFallbackLine()` for marginal conditions. This is pure presentation logic with no time-aware orchestration.

- [`kit-advisory.ts`](./kit-advisory.ts)
  Email-specific kit advisory rendering (`kitAdvisoryCard`). The shared recommendation logic lives in [`../shared/kit-advisory.ts`](../shared/kit-advisory.ts), and [`index.ts`](./index.ts) re-exports that shared API.

- [`next-day.ts`](./next-day.ts)
  Email-specific summary cards for the days-ahead forecast and the daylight-utility strip.

- [`render-outdoor-outlook.ts`](./render-outdoor-outlook.ts)
  Canonical HTML renderer for hourly outdoor outlook sections. Pure presentation logic with no scoring decisions. Renders tables, rows, and debug context updates.

- [`debug-email.ts`](./debug-email.ts)
  Renders the internal debug email from `DebugContext`, including the AI trace, long-range candidate table, kit advisory trace, and outdoor-comfort trace.

## Supporting files outside this folder

- [`../../types/brief.ts`](../../types/brief.ts)
  Canonical shared render contract: windows, day summaries, alternatives, and the renderer input payload used across email/site/Telegram.

- [`../../lib/debug-context.ts`](../../lib/debug-context.ts)
  Debug context type used by debug-email output.

- [`../shared/brief-primitives.ts`](../shared/brief-primitives.ts)
  Cross-presenter render primitives: icons, colours, and stat helpers.

- [`../shared/presenter-context.ts`](../shared/presenter-context.ts)
  Shared email/site context builder for the common no-go/window, local-summary,
  top-alternative, and outlook state.

## Tests

- [`format-email.test.ts`](./format-email.test.ts) — hero, window summary, alternatives, long-range section, and spur-of-the-moment behavior.
- [`debug-email.test.ts`](./debug-email.test.ts) — debug email coverage.
- [`kit-advisory.test.ts`](./kit-advisory.test.ts) — kit advisory coverage and debug trace population checks.
- [`next-day.test.ts`](./next-day.test.ts) — integration tests for the email entrypoint's outdoor outlook exports and forecast cards.
- [`outdoor-comfort.test.ts`](../shared/outdoor-comfort.test.ts) — focused unit tests for comfort scoring, labels, and reason codes (in shared/).
- [`outdoor-outlook-model.test.ts`](../shared/outdoor-outlook-model.test.ts) — focused unit tests for window selection, model building, and summary generation (in shared/).
- [`render-outdoor-outlook.test.ts`](./render-outdoor-outlook.test.ts) — focused unit tests for HTML rendering of outdoor outlook tables.

## Working rule

If a change affects a specific vertical slice, prefer editing the slice module and its matching test file first. Only touch [`index.ts`](./index.ts) when the public assembly order or export surface actually changes.
