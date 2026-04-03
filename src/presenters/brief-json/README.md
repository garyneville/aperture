# Brief JSON Presenter Primer

This folder contains the machine-readable JSON output renderer. It produces the canonical structured brief representation used for downstream consumption, storage, and API responses.

## Purpose

- render the photo brief as structured JSON matching the `BriefJson` contract
- provide a stable, versioned schema for machine consumption
- enable downstream services to parse brief data without HTML scraping
- support persistence, analytics, and alternative presentation pipelines

## Public Entry Points

- [`render-brief-json.ts`](./render-brief-json.ts)
  `renderBriefAsJson(scoredContext, editorial)` — Main entry point. Returns a `BriefJson` object conforming to the schema.

## Main Files / Module Map

- `render-brief-json.ts`
  Single-file presenter that maps `ScoredForecastContext` and `EditorialDecision` to the `BriefJson` schema.

- `render-brief-json.test.ts`
  Unit tests verifying correct mapping of all fields and schema compliance.

## Data In / Data Out

**Input:**
```typescript
// From domain scoring
scoredContext: ScoredForecastContext

// From domain editorial
editorial: EditorialDecision
```

**Output (`BriefJson`):**
```typescript
{
  schemaVersion: string        // "1.0" (from contracts)
  generatedAt: string | null
  location: {
    name: string | null
    timezone: string | null
    latitude: number | null
    longitude: number | null
  }
  dontBother: boolean
  windows: Window[]
  todayCarWash: CarWash
  dailySummary: DaySummary[]
  altLocations: AltLocation[]
  closeContenders: AltLocation[]
  noAltsMsg: string | undefined
  // ... (see ../../contracts/brief.ts for complete type)
  aiText: string
  compositionBullets: string[]
  weekInsight: string
  spurOfTheMoment: SpurSuggestion | undefined
  geminiInspire: string | undefined
  debugContext: DebugContext | undefined
}
```

## Schema Versioning

The `BriefJson` contract includes a `schemaVersion` field (currently `"1.0"`). When making breaking changes:

1. Update `BRIEF_JSON_SCHEMA_VERSION` in [`../../contracts/brief.ts`](../../contracts/brief.ts)
2. Update this renderer to handle both old and new data if needed
3. Update downstream consumers
4. Document the change in the contracts file

## What Belongs Here

- Mapping domain types to the JSON schema
- Field selection and ordering for the output
- Null/default handling for optional fields
- Schema version handling

## What Does Not Belong Here

- **Business logic** — belongs in `src/domain`
- **Formatting/presentation** — belongs in sibling presenters (email, site, Telegram)
- **Schema definition** — belongs in `src/contracts/brief.ts`
- **Persistence logic** — belongs in adapters or infrastructure

## Tests

- [`render-brief-json.test.ts`](./render-brief-json.test.ts)
  Tests verify:
  - All required fields are present
  - Scored context maps correctly to output fields
  - Editorial content is included
  - Schema version is set
  - Null/undefined handling works correctly

## Working Rule

The Brief JSON presenter is a simple mapper. It should not transform data beyond what's necessary for JSON serialization (e.g., date formatting). Business logic decisions (what to include, how to calculate scores) happen upstream in the domain layer. This layer just packages the results.

## Usage Example

```typescript
import { renderBriefAsJson } from './render-brief-json.js';

const briefJson = renderBriefAsJson(scoredContext, editorial);

// Use for API response
response.json(briefJson);

// Use for persistence
await db.briefs.insert(briefJson);

// Use for downstream processing
queue.send('brief-generated', briefJson);
```

## Relationship to Other Presenters

All presenters start from the same domain data:

```
ScoredForecastContext + EditorialDecision
         ↓
    ┌────┴────┬──────────┬──────────┐
    ↓         ↓          ↓          ↓
 BriefJson  EmailHTML  SiteHTML  TelegramMsg
```

- **Brief JSON:** Machine-readable, structured, versioned
- **Email HTML:** Human-readable, rich formatting, email-compatible
- **Site HTML:** Human-readable, web-optimized, styled
- **Telegram:** Human-readable, concise, mobile-optimized

## Related Docs

- [`../../contracts/brief.ts`](../../contracts/brief.ts) — Schema definition
- [`../../contracts/README.md`](../../contracts/README.md) — Contracts overview
- [`../README.md`](../README.md) — Presenter layer overview
