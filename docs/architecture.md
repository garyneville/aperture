# Aperture Architecture

`Aperture` is a single-package application that turns forecast data into a scored photography brief, editorial summary, and delivery artifacts.

## Pipeline

The canonical application flow is implemented by [`src/app/run-photo-brief/use-case.ts`](../src/app/run-photo-brief/use-case.ts):

1. Acquire forecast payloads.
2. Score hourly and daily conditions.
3. Build the editorial request.
4. Resolve editorial output and fallbacks.
5. Render presentation outputs.
6. Persist and/or deliver the assembled run.

That sequence is the main architectural spine for both contributors and generated workflows.

## Data Flow (Plain English)

Here's how data moves through the system:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

External APIs (weather, air quality, aurora)
         ↓
┌─────────────────┐
│  n8n Adapters   │  ← Normalize external payloads, read config
│ (src/adapters)  │
└────────┬────────┘
         ↓
┌─────────────────┐
│  App Layer      │  ← Orchestrate the pipeline
│ (src/app)       │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Domain Layer   │  ← Business logic: scoring + editorial
│ (src/domain)    │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Presenters     │  ← Format outputs: email, site, Telegram, JSON
│ (src/presenters)│
└────────┬────────┘
         ↓
   Email, Site, Telegram, JSON
```

The **App Layer** (`src/app/run-photo-brief/use-case.ts`) coordinates everything but delegates all actual work:
- It doesn't score weather — it calls `src/domain/scoring/`
- It doesn't generate editorial — it calls `src/domain/editorial/`
- It doesn't format output — it calls `src/presenters/`

This makes the pipeline easy to test: each layer can be tested in isolation, and the use case can be tested with injected test doubles.

## Layers

### App

- [`src/app/run-photo-brief/use-case.ts`](../src/app/run-photo-brief/use-case.ts)
  The orchestration entrypoint. Sequences the 6-stage pipeline with timing.
- [`src/app/run-photo-brief/contracts.ts`](../src/app/run-photo-brief/contracts.ts)
  Stable run-level contracts for forecast acquisition, editorial resolution, and rendered outputs.

**Rule:** Code here coordinates between layers. It doesn't implement business logic or formatting.

### Domain

- [`src/domain/scoring`](../src/domain/scoring)
  Forecast scoring and session recommendation logic.
- [`src/domain/editorial`](../src/domain/editorial)
  Prompt construction plus AI response parsing, validation, fallback selection, and composition filtering.

**Rule:** Code here is pure business logic. No knowledge of n8n, email formatting, or HTTP clients.

### Presenters

- [`src/presenters/email`](../src/presenters/email)
  Email rendering and debug email output.
- [`src/presenters/site`](../src/presenters/site)
  Static-site renderer with modular sections.
- [`src/presenters/telegram`](../src/presenters/telegram)
  Telegram formatting.
- [`src/presenters/brief-json`](../src/presenters/brief-json)
  Canonical machine-readable brief output.
- [`src/presenters/shared`](../src/presenters/shared)
  Cross-presenter render primitives (icons, colours, stat helpers).

**Rule:** Code here transforms data into presentation formats. No business logic, no API calls.

### Library

- [`src/lib`](../src/lib)
  Shared infrastructure: astronomy helpers, scoring utilities, location data, debug context, icon assets, and other cross-cutting modules used by domain and presenter layers.

**Rule:** Modules here must not import from `src/domain`, `src/presenters`, or `src/app`. They may import from each other and from `src/types`.

### Adapters

- [`src/adapters/n8n`](../src/adapters/n8n)
  n8n runtime boundary: input normalization, config lookup, workflow-node shaping, and app/domain invocation.

**Rule:** Keep adapters thin. If business logic starts to dominate, extract it into `src/app`, `src/domain`, or `src/presenters`.

### Contracts

- [`src/contracts`](../src/contracts)
  Public cross-layer type contracts. Import from here rather than from internal implementation paths.

### Workflow Build

- [`workflow/source/skeleton.json`](../workflow/source/skeleton.json)
  Editable workflow source.
- [`workflow/build/compile-email.ts`](../workflow/build/compile-email.ts)
  Compiles MJML templates into the generated email layout module.
- [`workflow/build/assemble.ts`](../workflow/build/assemble.ts)
  Bundles adapters into code nodes and assembles the committed workflow artifact.
- [`generated/workflow/photography-weather-brief.json`](../generated/workflow/photography-weather-brief.json)
  Generated n8n workflow output.

**Rule:** Build-time code only. No runtime dependencies.

## Runtime vs Build-Time

**Runtime:** Everything in `src/` runs when the brief is generated:
- Adapters receive n8n input
- App orchestrates the pipeline
- Domain scores and generates editorial
- Presenters format outputs
- Adapters deliver results

**Build-Time:** Code in `workflow/build/` runs during development to generate the n8n workflow:
- `compile-email.ts` — Compiles MJML to TypeScript
- `assemble.ts` — Bundles adapters and generates workflow JSON

This separation means:
- The application logic is independent of n8n
- The workflow artifact is generated, not hand-edited
- The system can run without n8n (see below)

## n8n Integration

Currently, n8n is the runtime host:

1. **n8n trigger** (schedule or webhook) starts the workflow
2. **n8n HTTP nodes** fetch forecast data from providers
3. **n8n code nodes** call adapter functions in `src/adapters/n8n/`
4. **Adapters** normalize input and call the app layer
5. **App layer** orchestrates domain and presenters
6. **Adapters** shape outputs for downstream n8n nodes
7. **n8n nodes** send email, Telegram, and commit to gh-pages

**Key point:** n8n surrounds the application but is not part of it. The app code in `src/` has no n8n imports. Adapters provide the bridge.

### Running Without n8n

The architecture supports running without n8n:

1. Replace the adapter layer with HTTP handlers (Express, Fastify, etc.)
2. Implement `acquireForecastBundle()` to call weather APIs directly
3. Call `runPhotoBrief()` from your route handler
4. Implement `deliverOutputs()` to send via your preferred channels

The domain and presenter layers are completely independent of n8n. Only the adapter layer changes.

## Public Entrypoints

These are the stable seams that external callers and generated workflows should depend on:

- [`src/app/run-photo-brief/use-case.ts`](../src/app/run-photo-brief/use-case.ts)
- [`src/app/run-photo-brief/contracts.ts`](../src/app/run-photo-brief/contracts.ts)
- [`src/contracts/run-photo-brief.ts`](../src/contracts/run-photo-brief.ts)
- [`src/contracts/brief.ts`](../src/contracts/brief.ts)
- [`src/contracts/scored-forecast.ts`](../src/contracts/scored-forecast.ts)
- [`src/presenters/email/index.ts`](../src/presenters/email/index.ts)

Everything else is internal and free to evolve without a migration period.

## Contracts vs Types

**Contracts (`src/contracts/`)** are for cross-layer sharing:
- Stable public API
- Versioned when breaking changes occur
- Import from `../contracts/` in layer code
- Re-exported from `src/contracts/index.ts`

**Types (`src/types/`)** are for internal use:
- Implementation details
- May change without notice
- Don't import across layer boundaries
- Import only within the same layer

When adding a new shared type:
1. Start in the layer that owns it (e.g., `src/domain/scoring/`)
2. If other layers need it, re-export from `src/contracts/`
3. Import from contracts in consuming layers

## Guardrails

Refactors should keep these green at every step:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run verify:generated`

## Documentation Index

- [`src/app/README.md`](../src/app/README.md) — App layer orchestration
- [`src/app/run-photo-brief/README.md`](../src/app/run-photo-brief/README.md) — Main use case
- [`src/domain/README.md`](../src/domain/README.md) — Domain layer overview
- [`src/domain/scoring/README.md`](../src/domain/scoring/README.md) — Scoring details
- [`src/domain/editorial/README.md`](../src/domain/editorial/README.md) — Editorial details
- [`src/presenters/README.md`](../src/presenters/README.md) — Presenter layer overview
- [`src/presenters/email/README.md`](../src/presenters/email/README.md) — Email presenter
- [`src/presenters/site/README.md`](../src/presenters/site/README.md) — Site presenter
- [`src/presenters/telegram/README.md`](../src/presenters/telegram/README.md) — Telegram presenter
- [`src/presenters/brief-json/README.md`](../src/presenters/brief-json/README.md) — JSON output
- [`src/presenters/shared/README.md`](../src/presenters/shared/README.md) — Shared primitives
- [`src/contracts/README.md`](../src/contracts/README.md) — Public contracts
- [`src/adapters/n8n/README.md`](../src/adapters/n8n/README.md) — n8n adapter boundary
- [`src/lib/README.md`](../src/lib/README.md) — Shared utilities
- [`workflow/build/README.md`](../workflow/build/README.md) — Workflow generation
