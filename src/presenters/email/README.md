# Format Email Primer

This folder holds the photo brief email formatter.

The public entrypoint is [`index.ts`](./index.ts).

## Module map

- [`types.ts`](./types.ts)
  Local re-export of the canonical brief render contracts from [`../../types/brief.ts`](../../types/brief.ts).

- [`shared.ts`](./shared.ts)
  Cross-cutting render helpers and shared presentation primitives: colors, typography, cards, pills, stat grids, weather/moon icons, and a few general formatting helpers.

- [`time-aware.ts`](./time-aware.ts)
  Rerun-aware window display logic. This is where local windows are classified as past/current/future, where the "next window" promotion happens, and where the today-window section is rendered.
  
  **Note:** General-purpose window helpers (`displaySessionName`, `bestTimeLabel`, `localSummaryLines`, etc.) have been moved to [`../shared/window-helpers.ts`](../shared/window-helpers.ts) for cross-presenter use. This module re-exports them for backwards compatibility.

- [`kit-advisory.ts`](./kit-advisory.ts)
  Email-specific kit advisory rendering (`kitAdvisoryCard`). The core recommendation logic has been moved to [`../shared/kit-advisory.ts`](../shared/kit-advisory.ts) for cross-presenter use. This module re-exports `buildKitTips` and `evaluateKitRules` for backwards compatibility.

- [`next-day.ts`](./next-day.ts)
  Outdoor-comfort scoring plus the "remaining today" / "tomorrow at a glance" weather tables and the days-ahead forecast cards.

- [`debug-email.ts`](./debug-email.ts)
  Renders the internal debug email from `DebugContext`, including the AI trace, long-range candidate table, kit advisory trace, and outdoor-comfort trace.

## Supporting files outside this folder

- [`../../types/brief.ts`](../../types/brief.ts)
  Canonical shared render contract: windows, day summaries, alternatives, and the renderer input payload used across email/site/Telegram.

- [`../../lib/debug-context.ts`](../../lib/debug-context.ts)
  Debug context type used by debug-email output.

- [`../shared/brief-primitives.ts`](../shared/brief-primitives.ts)
  Cross-presenter render primitives: icons, colours, and stat helpers.

## Tests

- [`format-email.test.ts`](./format-email.test.ts) — hero, window summary, alternatives, long-range section, and spur-of-the-moment behavior.
- [`debug-email.test.ts`](./debug-email.test.ts) — debug email coverage.
- [`kit-advisory.test.ts`](./kit-advisory.test.ts) — kit advisory coverage and debug trace population checks.
- [`next-day.test.ts`](./next-day.test.ts) — outdoor-comfort scoring and hourly outlook coverage.

## Working rule

If a change affects a specific vertical slice, prefer editing the slice module and its matching test file first. Only touch [`index.ts`](./index.ts) when the public assembly order or export surface actually changes.
