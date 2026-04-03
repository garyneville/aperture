# Run Photo Brief Use Case

This folder contains the canonical orchestration spine for the photo brief application. It implements the end-to-end pipeline from forecast acquisition through rendered output delivery.

## Purpose

- run the complete photo brief workflow in sequence
- time each stage for performance monitoring
- assemble the final `StandaloneBriefRun` artifact with all intermediate results
- support dependency injection for testing and alternative implementations

## Public Entry Points

- [`use-case.ts`](./use-case.ts)
  `runPhotoBrief(deps)` — Main entry point. Accepts injected dependencies for all stages, times execution, and returns the complete run artifact.

- [`contracts.ts`](./contracts.ts)
  Type definitions for the use case: `StandaloneRunnerDependencies`, `StandaloneBriefRun`, `ForecastBundle`, `EditorialRequest`, `EditorialDecision`, `RenderedOutputs`, and stage types.

## Main Files / Module Map

- `use-case.ts`
  The orchestration logic. Implements a 6-stage pipeline:
  1. **acquire** — Fetch forecast payloads from providers
  2. **score** — Score hourly and daily conditions
  3. **buildEditorialRequest** — Build the editorial prompt
  4. **resolveEditorial** — Resolve editorial output with fallbacks
  5. **render** — Render all presentation outputs
  6. **persist/deliver** — Optional persistence and delivery

- `contracts.ts`
  Stable contracts for the use case. These are the types that external callers should depend on.

- `deliver-site.ts`
  Helper for site output delivery.

- `use-case.test.ts`
  Unit tests demonstrating how to inject test doubles for each stage.

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
