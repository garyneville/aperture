# Site Presenter Primer

This folder contains the static site HTML renderer. It transforms brief data into a complete, styled HTML document suitable for web deployment.

## Purpose

- render the photo brief as a complete HTML web page
- organize content into modular sections for maintainability
- share visual styling with email output via shared primitives
- support both the primary site output and gh-pages deployment

## Public Entry Points

- [`format-site.ts`](./format-site.ts)
  `formatSite(input)` — Main entry point. Accepts `BriefRenderInput` and returns a complete HTML document string.

- [`site-layout.ts`](./site-layout.ts)
  `renderSiteDocument(content, options)` — HTML document wrapper with head, styles, and body structure.

## Main Files / Module Map

### Core Formatters

- `format-site.ts`
  Orchestrates section assembly. Imports all section modules and composes them into the final page content, then passes to `site-layout.ts` for document wrapping.

- `site-layout.ts`
  HTML document template with CSS variables, responsive styles, and script includes. Wraps the section content in a complete `<!DOCTYPE html>` document.

### Sections (`sections/`)

Each section is a self-contained module that renders one visual area of the page:

| Section | File | Purpose |
|---------|------|---------|
| Hero Card | `hero.ts` | Main score display, location, date, primary window highlight |
| Signal Cards | `signals.ts` | Aurora, moon, sunset hue signal indicators |
| Window | `window.ts` | Detailed shooting window display with hourly breakdown |
| Daylight Utility | `daylight-utility.ts` | Sunrise/sunset timeline bar |
| Session Recommendation | `session-rec.ts` | Recommended photography session card |
| Creative Spark | `creative-spark.ts` | AI-generated creative text section |
| Kit Advisory | `kit-advisory.ts` | Photography equipment recommendations |
| Alternatives | `alternatives.ts` | Nearby alternative locations comparison |
| Long Range | `long-range.ts` | Long-range destination recommendations |
| Hourly Outlook | `hourly-outlook.ts` | Hour-by-hour conditions table |
| Photo Forecast | `forecast.ts` | Multi-day forecast cards |
| Spur of Moment | `spur-of-moment.ts` | Spur-of-the-moment suggestion card |
| Footer | `footer.ts` | Legend, key, and footer content |
| Shared | `shared.ts` | Section utilities and common patterns |

## Data In / Data Out

**Input (`BriefRenderInput`):**
```typescript
{
  dontBother: boolean
  windows: Window[]
  dailySummary: DaySummary[]
  altLocations: AltLocation[]
  closeContenders: AltLocation[]
  aiText: string
  compositionBullets: string[]
  weekInsight: string
  sessionRecommendation: SessionRecommendationSummary
  // ... (see ../../types/brief.ts for complete type)
}
```

**Output:**
Complete HTML document string ready for:
- Saving to `generated/site/` for the gh-pages branch
- Direct browser viewing
- Integration with the n8n workflow delivery step

## What Belongs Here

- HTML markup generation for the site output
- Section-specific layout and styling
- Section module organization (one concern per file)
- Responsive CSS considerations
- Page-level structure decisions

## What Does Not Belong Here

- **Business logic** — belongs in `src/domain`
- **Shared icons/colors** — belongs in `../shared/brief-primitives.ts`
- **Email-specific formatting** — belongs in `../email/`
- **Telegram formatting** — belongs in `../telegram/`

## Tests

- [`format-site.test.ts`](./format-site.test.ts)
  Tests for complete page rendering and section inclusion.

## Working Rule

Prefer editing section modules over modifying `format-site.ts` directly. Each section should be self-contained and testable in isolation. When adding a new section:

1. Create a new file in `sections/`
2. Export a function that takes the input data and returns an HTML string
3. Import and call it from `format-site.ts`
4. Add tests for the new section

Keep `format-site.ts` focused on orchestration: gathering data, calling sections in order, and passing the assembled content to `site-layout.ts`.

## Related Docs

- [`../email/README.md`](../email/README.md) — Email presenter (shares content structure)
- [`../shared/README.md`](../shared/README.md) — Shared primitives (colors, icons)
- [`../../types/brief.ts`](../../types/brief.ts) — Input type definition
- [`../../app/run-photo-brief/README.md`](../../app/run-photo-brief/README.md) — How site rendering fits into the pipeline
