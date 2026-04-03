# Windowing Primer

This folder contains window scheduling and display policy logic. It provides pure functions for determining which windows to display, how to classify them relative to the current time, and generating fallback text.

## Purpose

- convert between clock strings and minute values
- classify windows as past, current, or future relative to a reference time
- build display plans showing primary, remaining, and past windows
- generate time-aware fallback text for editorial

## Public Entry Points

- [`index.ts`](./index.ts)
  Re-exports all windowing functions.

## Main Files / Module Map

- `time.ts`
  Time conversion utilities:
  - `clockToMinutes(clock: string): number | null`
  - `minutesToClock(minutes: number): string`

- `policy.ts`
  Window scheduling policy:
  - `windowRange(window): string` — Format window time range
  - `classifyWindowTiming(window, nowMinutes)` — Classify as past/current/future
  - `buildWindowDisplayPlan(windows, nowMinutes)` — Build display plan
  - `getRunTimeContext(debugContext)` — Get runtime context from metadata

- `fallback.ts`
  Fallback text generation:
  - `timeAwareBriefingFallback(plan)` — Generate time-aware fallback text

## Data In / Data Out

**Input:**
- `Window[]` from scored forecast context
- Current time in minutes or debug context with metadata

**Output:**
- `WindowDisplayPlan` with primary, remaining, past windows
- Classification strings ('past' | 'current' | 'future')
- Fallback text or null

## What Belongs Here

- Pure functions for window time calculations
- Window classification logic
- Display planning algorithms
- Fallback text generation that depends on window timing

## What Does Not Belong Here

- **HTML/formatting** — belongs in presenters
- **Weather scoring** — belongs in `../scoring/`
- **Editorial resolution** — belongs in `../editorial/`
- **Astronomy calculations** — belongs in `../../lib/astro.ts`

## Tests

Tests should be added alongside each module:
- `time.test.ts` — Time conversion edge cases
- `policy.test.ts` — Window classification and display plan logic
- `fallback.test.ts` — Fallback text generation

## Working Rule

This module must remain pure — no side effects, no I/O, no HTML generation. It transforms window data and time values into decisions about which windows to show. Presenters use these decisions to render output; domain logic uses them for validation and fallback selection.

## Related Docs

- [`../editorial/README.md`](../editorial/README.md) — Editorial resolution (uses this module)
- [`../../presenters/email/README.md`](../../presenters/email/README.md) — Email presenter (uses this module)
- [`../../contracts/brief.ts`](../../contracts/brief.ts) — Window and RunTimeContext contract types
