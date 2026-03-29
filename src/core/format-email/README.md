# Format Email Primer

This folder holds the high-churn parts of the photo brief email formatter.

The public entrypoint is still [`../format-email.ts`](../format-email.ts). That file remains the compatibility shim and orchestrator used by the n8n adapter and existing tests. It imports the modules below, assembles the full email, and re-exports the public helper functions and types.

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

- [`../format-email.ts`](../format-email.ts)
  Public API and top-level composition. Keep this stable unless the external import path is intentionally changing.

- [`../format-email.test.ts`](../format-email.test.ts)
  Integration-heavy formatter tests: hero, window summary, alternatives, long-range section, and spur-of-the-moment behavior.

- [`../format-email.debug-email.test.ts`](../format-email.debug-email.test.ts)
  Debug email coverage.

- [`../format-email.kit-advisory.test.ts`](../format-email.kit-advisory.test.ts)
  Kit advisory coverage and debug trace population checks.

- [`../format-email.next-day.test.ts`](../format-email.next-day.test.ts)
  Outdoor-comfort scoring and hourly outlook coverage.

## Working rule

If a change affects a specific vertical slice, prefer editing the slice module and its matching test file first. Only touch [`../format-email.ts`](../format-email.ts) when the public assembly order, export surface, or cross-section composition actually changes.
