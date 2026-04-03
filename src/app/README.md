# App Layer Primer

This folder contains the application orchestration layer. Code here wires together domain logic, presenters, and adapters to form complete use cases.

## Purpose

- orchestrate the main application workflows
- coordinate between domain logic, presenters, and external adapters
- manage the sequencing of operations (acquire → score → editorial → render → deliver)
- provide stable entrypoints for external callers and generated workflows

## Public Entry Points

- [`run-photo-brief/use-case.ts`](./run-photo-brief/use-case.ts)
  The canonical orchestration spine. Implements the complete photo brief pipeline from forecast acquisition through delivery.

- [`run-photo-brief/contracts.ts`](./run-photo-brief/contracts.ts)
  Stable run-level contracts for forecast acquisition, editorial resolution, and rendered outputs.

## Main Files / Module Map

- `run-photo-brief/`
  - `use-case.ts` — Main orchestration use case with stage timing
  - `contracts.ts` — Type contracts for the use case inputs/outputs
  - `deliver-site.ts` — Site delivery helper
  - `use-case.test.ts` — Unit tests for the orchestration logic

## Data In / Data Out

**Input:**
- Forecast bundle from weather providers (via adapter)
- Runtime configuration
- Scoring and editorial dependencies (injected for testability)

**Output:**
- `StandaloneBriefRun` containing all intermediate and final artifacts
- Rendered outputs (email HTML, site HTML, Telegram message, brief JSON)
- Optional persistence and delivery side effects

## What Belongs Here

- Use case orchestration that coordinates multiple layers
- Sequencing logic for multi-stage operations
- Integration between domain logic and external concerns
- Code that would live in a "service" or "application service" layer in other architectures

## What Does Not Belong Here

- **Business logic** should live in `src/domain` (scoring rules, editorial decisions)
- **Presentation formatting** should live in `src/presenters` (HTML generation, message formatting)
- **External adapter concerns** should live in `src/adapters` (n8n normalization, HTTP clients)
- **Pure utilities** should live in `src/lib`

## Tests

- [`run-photo-brief/use-case.test.ts`](./run-photo-brief/use-case.test.ts)

## Working Rule

If code is coordinating between multiple layers or managing the sequence of a workflow, it belongs in `app`. If code is implementing business rules or calculations, it belongs in `domain`. Keep app layer thin—most complexity should push down to domain or across to presenters.

## Related Docs

- [`../domain/scoring/README.md`](../domain/scoring/README.md) — Scoring domain logic
- [`../domain/editorial/README.md`](../domain/editorial/README.md) — Editorial domain logic
- [`../presenters/README.md`](../presenters/README.md) — Presenter layer overview
- [`../adapters/n8n/README.md`](../adapters/n8n/README.md) — n8n adapter boundary
