# Library Primer

This folder is the canonical infrastructure layer: shared utilities, astronomy helpers, location data, scoring tools, and icon assets used across domain, presenter, and adapter layers.

## Purpose

- provide self-contained utility modules with no dependency on domain or presenter layers
- own shared data (locations, icon SVGs) that multiple slices consume
- expose scoring helpers (`shared-scoring`, `score-alternatives`, `score-long-range`, `best-windows`) used by both domain logic and adapters

## Module map

### Astronomy

- [`astro.ts`](./astro.ts) — moon metrics, solar altitude, moon score adjustment, and dark-sky timing.
- [`astro-score-explanation.ts`](./astro-score-explanation.ts) — human-readable explanation of astro score gaps.
- [`aurora-providers.ts`](./aurora-providers.ts) — aurora signal parsing and fusion from upstream providers.
- [`aurora-visibility.ts`](./aurora-visibility.ts) — aurora visibility estimation from KP index.

### Scoring utilities

- [`best-windows.ts`](./best-windows.ts) — selects and labels the best photo windows from hourly scores.
- [`score-alternatives.ts`](./score-alternatives.ts) — scores nearby alternative locations against home conditions.
- [`score-long-range.ts`](./score-long-range.ts) — scores long-range trip destinations and produces a ranked shortlist.
- [`shared-scoring.ts`](./shared-scoring.ts) — shared hourly/daily scoring helpers used by score-alternatives and score-long-range.
- [`site-darkness.ts`](./site-darkness.ts) — Bortle-class site darkness lookup and dark-sky classification.

### Location data

- [`long-range-locations.ts`](./long-range-locations.ts) — canonical long-range location registry with drive-time helpers.
- [`prepare-alt-locations.ts`](./prepare-alt-locations.ts) — alt-location registry with Open-Meteo URL builder.
- [`prepare-long-range.ts`](./prepare-long-range.ts) — filters and enriches long-range locations with forecast URLs.
- [`prepare-azimuth.ts`](./prepare-azimuth.ts) — generates azimuth sample points for sunrise/sunset horizon scans.
- [`aggregate-azimuth.ts`](./aggregate-azimuth.ts) — aggregates multi-distance azimuth scan results into horizon metrics.

### Debug and AI

- [`debug-context.ts`](./debug-context.ts) — DebugContext type and empty-context factory.
- [`debug-payload.ts`](./debug-payload.ts) — debug payload snapshot serialization with intelligent summarization. Reduces verbose API responses (e.g., 120-item hourly arrays) to compact statistics (min/max/mean/count), collapses null arrays, and truncates large objects to keep debug output readable.
- [`ai-briefing.ts`](./ai-briefing.ts) — renders the AI briefing text block for email and site output.

### Assets

- [`moon-icons.ts`](./moon-icons.ts) — inline SVG strings for Meteocons moon phase icons.
- [`weather-icons.ts`](./weather-icons.ts) — inline SVG strings for Meteocons weather icons.

### Utilities

- [`utils.ts`](./utils.ts) — general-purpose helpers (clamp, esc, etc.).

## Tests

Tests live beside each module:

- `astro.test.ts`, `astro-score-explanation.test.ts`, `aurora-providers.test.ts`
- `best-windows.test.ts`, `score-alternatives.test.ts`, `score-long-range.test.ts`, `shared-scoring.test.ts`
- `aggregate-azimuth.test.ts`, `prepare-locations.test.ts`
- `ai-briefing.test.ts`

## Working rule

Modules in `src/lib` must not import from `src/domain`, `src/presenters`, or `src/app`. They may import from each other and from `src/types`.
