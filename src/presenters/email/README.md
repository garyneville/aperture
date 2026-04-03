# Format Email Primer

This folder holds the photo brief email formatter.

The public entrypoint is [`index.ts`](./index.ts).

## Module map

- [`types.ts`](./types.ts)
  Local re-export of the canonical brief render contracts from [`../../types/brief.ts`](../../types/brief.ts).

- [`shared.ts`](./shared.ts)
  Cross-cutting render helpers and shared presentation primitives: colors, typography, cards, pills, stat grids, weather/moon icons, and a few general formatting helpers.

- [`time-aware.ts`](./time-aware.ts)
  Rerun-aware window display logic. This is where local windows are classified as past/current/future, where the "next window" promotion happens, and where the today-window section is assembled.
  
  **Note:** This module is now focused on email-specific rendering orchestration. Card rendering has moved to [`window-cards.ts`](./window-cards.ts) and general-purpose window helpers have moved to [`../shared/window-helpers.ts`](../shared/window-helpers.ts). Both are re-exported for backwards compatibility.

- [`window-cards.ts`](./window-cards.ts)
  Email-specific window card rendering. Contains `windowCard()` for rendering individual photography windows, `compositionCard()` for shot ideas, and `poorDayFallbackLine()` for marginal conditions. This is pure presentation logic with no time-aware orchestration.

- [`kit-advisory.ts`](./kit-advisory.ts)
  Email-specific kit advisory rendering (`kitAdvisoryCard`). The core recommendation logic has been moved to [`../shared/kit-advisory.ts`](../shared/kit-advisory.ts) for cross-presenter use. This module re-exports `buildKitTips` and `evaluateKitRules` for backwards compatibility.

- [`next-day.ts`](./next-day.ts)
  Facade module that re-exports from the split outdoor outlook modules. Also contains photo forecast cards and daylight utility card (separate concerns that may move in future refactoring).

- [`outdoor-comfort.ts`](./outdoor-comfort.ts)
  **Re-export compatibility layer.** The implementation has moved to [`../shared/outdoor-comfort.ts`](../shared/outdoor-comfort.ts). This file re-exports for backwards compatibility. Pure functions for outdoor comfort scoring (0-100), labels, and reason codes.

- [`outdoor-outlook-model.ts`](./outdoor-outlook-model.ts)
  **Re-export compatibility layer.** The implementation has moved to [`../shared/outdoor-outlook-model.ts`](../shared/outdoor-outlook-model.ts). This file re-exports for backwards compatibility. Data model building for outdoor outlook displays.

- [`render-outdoor-outlook.ts`](./render-outdoor-outlook.ts)
  HTML rendering for outdoor outlook sections. Pure presentation logic - no scoring or algorithmic decisions. Renders tables, rows, and debug context updates.

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
- [`next-day.test.ts`](./next-day.test.ts) — integration tests for the outdoor outlook facade (re-exports).
- [`outdoor-comfort.test.ts`](../shared/outdoor-comfort.test.ts) — focused unit tests for comfort scoring, labels, and reason codes (in shared/).
- [`outdoor-outlook-model.test.ts`](../shared/outdoor-outlook-model.test.ts) — focused unit tests for window selection, model building, and summary generation (in shared/).
- [`render-outdoor-outlook.test.ts`](./render-outdoor-outlook.test.ts) — focused unit tests for HTML rendering of outdoor outlook tables.

## Working rule

If a change affects a specific vertical slice, prefer editing the slice module and its matching test file first. Only touch [`index.ts`](./index.ts) when the public assembly order or export surface actually changes.
