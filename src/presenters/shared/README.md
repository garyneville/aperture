# Shared Presenter Primitives Primer

This folder contains cross-cutting render primitives used by multiple presenters. These are presentation utilities that don't belong to any single output channel.

## Purpose

- share common formatting utilities across email, site, and other presenters
- provide consistent colors, icons, and styling primitives
- avoid duplication of presentation constants
- keep individual presenters focused on layout, not utility functions

## Public Entry Points

- [`brief-primitives.ts`](./brief-primitives.ts)
  Main export file containing colors, fonts, icons, score helpers, and formatting utilities.

- [`window-helpers.ts`](./window-helpers.ts)
  Cross-presenter utilities for window and session display. Functions for formatting session names, window labels, moon descriptors, and time-aware summaries.

- [`kit-advisory.ts`](./kit-advisory.ts)
  Rule-based kit recommendation logic shared across presenters. Builds photography equipment tips based on weather conditions.

- [`outdoor-comfort.ts`](./outdoor-comfort.ts)
  Pure functions for outdoor comfort scoring (0-100), labels, and reason codes. Input: weather metrics. Output: comfort score, label with styling, and reason strings. This is the "tuning seam" for outdoor comfort algorithm adjustments. Moved from `../email/` to enable sharing across presenters.

- [`outdoor-outlook-model.ts`](./outdoor-outlook-model.ts)
  Data model building for outdoor outlook displays. Handles hour filtering, contiguous window selection, best window detection, and summary generation. Pure algorithmic logic with no HTML rendering. Moved from `../email/` to enable sharing across presenters.

## Main Files / Module Map

- `brief-primitives.ts`
  Single-file module exporting:
  - **Colors (`C`)** — Centralized color palette from design tokens
  - **Typography** — Font family constants
  - **Icons** — Brand logo SVG, utility glyphs
  - **Score Helpers** — Score thresholds, score state calculation, confidence detail
  - **Stat Helpers** — Summary stat formatting, confidence formatting
  - **Car Wash Helpers** — Car wash rating calculation

- `window-helpers.ts`
  Window and session display utilities:
  - **Session Names** — `displaySessionName()` maps SessionId to display names
  - **Window Labels** — `bestTimeLabel()`, `bestDaySessionLabel()` for window labeling
  - **Moon Descriptors** — `moonDescriptor()` for moon phase display
  - **Window Helpers** — `isAstroWindow()`, `peakHourForWindow()` for window analysis
  - **Summary Builders** — `localSummaryLines()`, `timeAwareLocalSummary()` for text generation
  - **Tag Formatting** — `displayTag()`, `displayBestTags()` for condition tags

- `kit-advisory.ts`
  Kit recommendation logic:
  - **Tip Building** — `buildKitTips()` generates equipment recommendations
  - **Rule Evaluation** — `evaluateKitRules()` for debug trace output

- `outdoor-comfort.ts`
  Outdoor comfort scoring logic:
  - **Scoring** — `outdoorComfortScore()` calculates 0-100 comfort score from weather metrics
  - **Labels** — `outdoorComfortLabel()` returns styled labels ("Best for a run/walk", "Pleasant", etc.)
  - **Reasons** — `outdoorComfortReason()` and `outdoorComfortReasonCodes()` explain suboptimal scores
  - **Configuration** — `COMFORT_SCORE_CONFIG`, `RUN_FRIENDLY_THRESHOLDS`, `COMFORT_REASON_THRESHOLDS` for tuning

- `outdoor-outlook-model.ts`
  Outdoor outlook model building:
  - **Model Building** — `buildOutdoorOutlookModel()` creates the complete outlook model from day data
  - **Window Detection** — Finds best outdoor windows using contiguous run analysis
  - **Summary Generation** — Builds human-readable summary lines for outdoor conditions
  - **Utilities** — `formatPhotoWindowList()` for formatting photo window lists

## Exported Primitives

### Colors (`C` object)

```typescript
C.page, C.surface, C.surfaceVariant  // Backgrounds
C.ink, C.muted, C.subtle             // Text
C.primary, C.secondary, C.tertiary   // Accents
C.success, C.warning, C.error        // States
C.accent, C.brand                    // Brand colors
// ... (see file for complete set)
```

All colors come from [`../../tokens/tokens.ts`](../../tokens/tokens.ts) and are kept in sync with the design system.

### Score Helpers

```typescript
SCORE_THRESHOLDS = { excellent: 75, good: 58, marginal: 42 }

scoreState(score): { label, fg, bg, border }
// Returns 'Excellent', 'Good', 'Marginal', or 'Poor' with appropriate colors

confidenceDetail(confidence): { label, fg, bg, border } | null
// Returns styling for 'high', 'medium', 'low', or 'unknown' confidence
```

### Icons

```typescript
BRAND_LOGO  // SVG string for the aperture logo
UTILITY_GLYPHS  // Emoji indicators (🚗 / 🚶)
// Weather and moon icons are in ../../lib/weather-icons.ts and moon-icons.ts
```

### Typography

```typescript
FONT  // Base font family
MONO  // Monospace font family
```

## What Belongs Here

- Color constants and palettes
- Score/confidence formatting helpers
- Icon SVGs and glyphs
- Typography constants
- Shared CSS-in-JS patterns
- General formatting utilities that multiple presenters need
- Cross-presenter algorithmic logic (outdoor comfort scoring, outlook model building)
- Data models shared by multiple output channels

## What Does Not Belong Here

- **Business logic** — belongs in `src/domain`
- **Presenter-specific layout** — belongs in the individual presenter folders
- **HTML document structure** — belongs in `../site/site-layout.ts`
- **Email-specific markup** — belongs in `../email/`
- **Complex formatting** — if it's specific to one section or output, keep it there

## Working Rule

Keep this layer thin. Only extract to `shared/` when:
1. At least two presenters need the same utility
2. It's a genuine presentation concern (color, icon, formatting)
3. It's not business logic in disguise

When in doubt, start in the specific presenter and extract later. Business logic should not accumulate here—if you find yourself adding scoring rules or editorial decisions, move that code to `src/domain`.

## Relationship to Design Tokens

This module re-exports from the design tokens system:

```
../../tokens/tokens.ts  (source of truth)
         ↓
   brief-primitives.ts  (presenter-friendly exports)
         ↓
   ../email/, ../site/  (consuming presenters)
```

When design tokens change, this module provides a compatibility layer for presenters.

## Related Docs

- [`../email/README.md`](../email/README.md) — Email presenter (major consumer)
- [`../site/README.md`](../site/README.md) — Site presenter (major consumer)
- [`../../tokens/tokens.ts`](../../tokens/tokens.ts) — Design token source
- [`../../lib/README.md`](../../lib/README.md) — Shared library utilities (not presenter-specific)
