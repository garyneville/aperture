# Format Email Primer

This folder holds the high-churn parts of the photo brief email formatter.

The public entrypoints are [`index.ts`](./index.ts) and the compatibility shim [`../../core/format-email.ts`](../../core/format-email.ts). The shim remains in place for adapters and tests that still import the legacy path.

## Module map

- [`types.ts`](./types.ts)
  Compatibility shim for the canonical brief render contracts in [`../../types/brief.ts`](../../types/brief.ts). It preserves the old import path for email-specific modules and tests.

- [`shared.ts`](./shared.ts)
  Cross-cutting render helpers and shared presentation primitives: colors, typography, cards, pills, stat grids, weather/moon icons, and a few general formatting helpers.

- [`time-aware.ts`](./time-aware.ts)
  Rerun-aware window display logic. This is where local windows are classified as past/current/future, where the “next window” promotion happens, and where the today-window section is rendered.

- [`kit-advisory.ts`](./kit-advisory.ts)
  Rule-based kit recommendation logic. It computes the displayed tips and the debug trace for which rules matched and which tips were shown.

- [`next-day.ts`](./next-day.ts)
  Outdoor-comfort scoring plus the “remaining today” / “tomorrow at a glance” weather tables and the days-ahead forecast cards.

- [`debug-email.ts`](./debug-email.ts)
  Renders the internal debug email from `DebugContext`, including the AI trace, long-range candidate table, kit advisory trace, and outdoor-comfort trace.

## Supporting files outside this folder

- [`../../types/brief.ts`](../../types/brief.ts)
  Canonical shared render contract: windows, day summaries, alternatives, and the renderer input payload used across email/site/Telegram.

- [`index.ts`](./index.ts)
  Public API and top-level composition for the presenter slice.

- [`../../core/format-email.ts`](../../core/format-email.ts)
  Compatibility re-export for existing callers and tests.

- [`../../core/format-email.test.ts`](../../core/format-email.test.ts)
  Integration-heavy formatter tests: hero, window summary, alternatives, long-range section, and spur-of-the-moment behavior.

- [`../../core/format-email.debug-email.test.ts`](../../core/format-email.debug-email.test.ts)
  Debug email coverage.

- [`../../core/format-email.kit-advisory.test.ts`](../../core/format-email.kit-advisory.test.ts)
  Kit advisory coverage and debug trace population checks.

- [`../../core/format-email.next-day.test.ts`](../../core/format-email.next-day.test.ts)
  Outdoor-comfort scoring and hourly outlook coverage.

## Working rule

If a change affects a specific vertical slice, prefer editing the slice module and its matching test file first. Only touch [`index.ts`](./index.ts) or [`../../core/format-email.ts`](../../core/format-email.ts) when the public assembly order or export surface actually changes.
