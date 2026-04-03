# Run Photo Brief Use Case

This folder contains the canonical orchestration spine for the photo brief application. It implements the end-to-end pipeline from forecast acquisition through rendered output delivery.

## Purpose

- run the complete photo brief workflow in sequence
- time each stage for performance monitoring
- assemble the final `StandaloneBriefRun` artifact with all intermediate results
- support dependency injection for testing and alternative implementations

## Public Entry Points

- [`use-case.ts`](./use-case.ts)
  `runPhotoBrief(deps)` — Main entry point for the full pipeline. Accepts injected dependencies for all stages, times execution, and returns the complete run artifact.

- [`finalize-brief.ts`](./finalize-brief.ts)
  `finalizeBrief(input, config)` — Assembles the final brief from scored forecast data and AI provider responses. This is the use case that bridges domain logic (editorial resolution) with presentation (rendering outputs). Called by the n8n adapter and the CLI runner.

- [`contracts.ts`](./contracts.ts)
  Type definitions for the main use case: `StandaloneRunnerDependencies`, `StandaloneBriefRun`, `ForecastBundle`, `EditorialRequest`, `EditorialDecision`, `RenderedOutputs`, and stage types.

- [`finalize-brief-contracts.ts`](./finalize-brief-contracts.ts)
  Type definitions for the finalize-brief use case: `RawEditorialInput`, `FinalizeConfig`, `FinalizedBrief`.

## Main Files / Module Map

- `use-case.ts`
  The main orchestration logic. Implements a 6-stage pipeline:
  1. **acquire** — Fetch forecast payloads from providers
  2. **score** — Score hourly and daily conditions
  3. **buildEditorialRequest** — Build the editorial prompt
  4. **resolveEditorial** — Resolve editorial output with fallbacks
  5. **render** — Render all presentation outputs
  6. **persist/deliver** — Optional persistence and delivery

- `finalize-brief.ts`
  The "finalize brief" use case. Orchestrates the final assembly of the brief:
  1. **normalize** — Parse AI provider responses
  2. **prepare** — Set up debug context
  3. **resolve** — Resolve editorial with fallbacks
  4. **hydrate** — Add debug trace information
  5. **render** — Generate all output formats (email, Telegram, site, JSON)
  
  This use case is called by the n8n adapter and can be called directly for CLI/testing.
  It is the only live finalization orchestration path; adapter-side helper copies
  of these steps have been removed.

- `finalize-brief-contracts.ts`
  Type contracts for the finalize-brief use case.

- `finalize-brief-cli.ts`
  CLI runner that demonstrates running the finalize-brief use case without n8n. Loads a fixture file and runs the use case.

- `contracts.ts`
  Stable contracts for the main use case.

- `deliver-site.ts`
  Helper for site output delivery.

- `use-case.test.ts`
  Unit tests for the main use case.

- `finalize-brief.test.ts`
  Unit tests for the finalize-brief use case. Tests the runtime-independent seam including:
  - Input normalization from AI providers
  - Debug context preparation and hydration
  - Output rendering orchestration
  - Gemini diagnostics extraction

## Dependency Rules

This module follows strict dependency rules:

- **Cross-layer types** are imported from `src/contracts`, not internal paths:
  ```typescript
  // Good
  import type { BriefContext, DebugContext } from '../../contracts/index.js';
  
  // Avoid
  import type { BriefContext } from '../../domain/editorial/resolution/resolve-editorial.js';
  import type { DebugContext } from '../../lib/debug-context.js';
  ```

- **Domain logic** is delegated to the domain layer — this module only orchestrates
- **Presenter formatting** is delegated to the presenters layer
- **Implementation details** (like `emptyDebugContext()`) can be imported from internal paths

`finalize-brief.ts` is the reference implementation for "how the app layer should look."

## Non-n8n Runtime (CLI)

The `finalize-brief-cli.ts` script demonstrates that the core application logic can run independently of n8n. This proves the architecture goal: **n8n is a delivery mechanism, not the place where the workflow lives.**

### CLI Usage Options

**Option 1 — npm scripts (recommended):**
```bash
# Run with any fixture file
npm run cli:finalize-brief -- ./fixtures/sample-forecast.json

# Run with the example fixture
npm run cli:example
```

**Option 2 — Direct ts-node execution:**
```bash
npx ts-node src/app/run-photo-brief/finalize-brief-cli.ts ./fixtures/sample-forecast.json
```

**Option 3 — Via bin entry (after `npm link`):**
```bash
# Install globally
npm link

# Run from anywhere
aperture-finalize-brief ./fixtures/sample-forecast.json
```

### Fixture Format

Create a JSON file with this structure:
```json
{
  "context": { /* BriefContext with windows, dailySummary, etc. */ },
  "groqChoices": [{ "message": { "content": "..." } }],
  "geminiResponse": "...",
  "geminiInspire": "...",
  "homeLocation": { "name": "Leeds", "lat": 53.8, "lon": -1.5, "timezone": "Europe/London" },
  "debug": { "enabled": true, "emailTo": "debug@example.com" },
  "preferredProvider": "groq"
}
```

See [`fixtures/sample-forecast.json`](../../fixtures/sample-forecast.json) for a complete example.

### Runtime Flexibility

The core logic in `src/app/run-photo-brief/` can be invoked from:
- **n8n** — via adapter (`src/adapters/n8n/format-messages.adapter.ts`)
- **CLI** — direct execution (shown above)
- **Future HTTP API** — direct import of `finalizeBrief()`
- **Test harness** — direct function calls with fixtures

Both the n8n adapter and the CLI use the same `finalizeBrief()` seam. That keeps
debug-context hydration, AI normalization, and rendering orchestration in one
place instead of duplicating those steps across runtimes.

## Data In / Data Out

**Input (via `StandaloneRunnerDependencies`):**
```typescript
{
  acquireForecastBundle(): Promise<ForecastBundle>
  scoreForecast(bundle): Promise<ScoredForecastContext>
  buildEditorialRequest(context): Promise<EditorialRequest>
  resolveEditorial(request): Promise<EditorialDecision>
  renderBrief(context, editorial): Promise<RenderedOutputs>
  persistRun?(run): Promise<void>      // optional
  deliverOutputs?(run): Promise<void>  // optional
  now?(): Date                         // optional, for testability
}
```

**Output (`StandaloneBriefRun`):**
```typescript
{
  generatedAt: string
  forecast: ForecastBundle
  scoredContext: ScoredForecastContext
  editorialRequest: EditorialRequest
  editorial: EditorialDecision
  outputs: RenderedOutputs      // { briefJson, telegramMsg, emailHtml, siteHtml?, ... }
  stageTimingsMs: Record<stage, number>
}
```

## What Belongs Here

- orchestration logic that sequences domain operations
- stage timing and performance tracking
- assembly of the final run artifact
- dependency injection interfaces for testability

## What Does Not Belong Here

- **Forecast acquisition logic** — belongs in adapters
- **Scoring algorithms** — belongs in `src/domain/scoring`
- **Editorial resolution** — belongs in `src/domain/editorial`
- **Rendering/formatting** — belongs in `src/presenters`
- **Persistence/delivery details** — belongs in adapters or infrastructure

## Tests

- [`use-case.test.ts`](./use-case.test.ts)
  Demonstrates injecting test doubles for each dependency. Tests verify:
  - All stages are called in order
  - Stage timings are recorded
  - The complete run artifact is assembled correctly
  - Optional persist/deliver hooks are invoked when provided

## Working Rule

The use case file should remain thin. Each stage delegates to domain or adapter layers. The use case owns the sequencing and timing, not the business logic. When adding new stages, extend `StandaloneRunnerDependencies` and add the stage to the `RunnerStage` union type.

## Related Docs

- [`../../domain/scoring/README.md`](../../domain/scoring/README.md) — Scoring logic delegated in stage 2
- [`../../domain/editorial/README.md`](../../domain/editorial/README.md) — Editorial logic delegated in stages 3-4
- [`../../presenters/README.md`](../../presenters/README.md) — Rendering logic delegated in stage 5
- [`../../adapters/n8n/README.md`](../../adapters/n8n/README.md) — How n8n calls this use case
- [`../../docs/architecture.md`](../../docs/architecture.md) — Overall architecture and pipeline
