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

## Layers

### App

- [`src/app/run-photo-brief/use-case.ts`](../src/app/run-photo-brief/use-case.ts)
  The orchestration entrypoint.
- [`src/app/run-photo-brief/contracts.ts`](../src/app/run-photo-brief/contracts.ts)
  Stable run-level contracts for forecast acquisition, editorial resolution, and rendered outputs.

### Domain

- [`src/domain/scoring`](../src/domain/scoring)
  Forecast scoring and session recommendation logic.
- [`src/domain/editorial`](../src/domain/editorial)
  Prompt construction plus AI response parsing, validation, fallback selection, and composition filtering.

### Presenters

- [`src/presenters/email`](../src/presenters/email)
  Email rendering and debug email output.
- [`src/presenters/site`](../src/presenters/site)
  Static-site renderer.
- [`src/presenters/telegram`](../src/presenters/telegram)
  Telegram formatting.
- [`src/presenters/brief-json`](../src/presenters/brief-json)
  Canonical machine-readable brief output.
- [`src/presenters/shared`](../src/presenters/shared)
  Cross-presenter render primitives (icons, colours, stat helpers).

### Library

- [`src/lib`](../src/lib)
  Shared infrastructure: astronomy helpers, scoring utilities, location data, debug context, icon assets, and other cross-cutting modules used by domain and presenter layers.

### Adapters

- [`src/adapters/n8n`](../src/adapters/n8n)
  n8n runtime boundary: input normalization, config lookup, workflow-node shaping, and app/domain invocation.

### Workflow Build

- [`workflow/source/skeleton.json`](../workflow/source/skeleton.json)
  Editable workflow source.
- [`workflow/build/compile-email.ts`](../workflow/build/compile-email.ts)
  Compiles MJML templates into the generated email layout module.
- [`workflow/build/assemble.ts`](../workflow/build/assemble.ts)
  Bundles adapters into code nodes and assembles the committed workflow artifact.
- [`generated/workflow/photography-weather-brief.json`](../generated/workflow/photography-weather-brief.json)
  Generated n8n workflow output.

## Public entrypoints

These are the stable seams that external callers and generated workflows should depend on:

- [`src/app/run-photo-brief/use-case.ts`](../src/app/run-photo-brief/use-case.ts)
- [`src/app/run-photo-brief/contracts.ts`](../src/app/run-photo-brief/contracts.ts)
- [`src/contracts/run-photo-brief.ts`](../src/contracts/run-photo-brief.ts)
- [`src/contracts/brief.ts`](../src/contracts/brief.ts)
- [`src/contracts/scored-forecast.ts`](../src/contracts/scored-forecast.ts)
- [`src/presenters/email/index.ts`](../src/presenters/email/index.ts)

Everything else is internal and free to evolve without a migration period.

## Guardrails

Refactors should keep these green at every step:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run verify:generated`
