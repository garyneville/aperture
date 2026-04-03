# Workflow Modularization Plan

## Goal

Make the photo-brief workflow faster to iterate on, easier to debug, and safer to change by moving high-churn logic out of inline n8n JSON strings and into normal typed TypeScript modules with direct tests.

## Current Friction

- A few important workflow behaviors still live as inline `jsCode` strings in `workflow/skeleton.json`.
- `src/editorial/resolve-editorial.ts` owns too many responsibilities at once.
- `src/adapters/n8n/format-messages.adapter.ts` is doing orchestration, normalization, debug hydration, editorial resolution, and output rendering in one place.
- Debugging node-boundary shape drift is harder than it should be because some payload contracts are implicit.

## Highest-Value Refactors

### 1. Convert Remaining Inline `jsCode` Nodes Into Adapters

Move these out of `workflow/skeleton.json` and into `src/adapters/n8n/`:

- `Code: Extract Gemini Fallback`
- `Code: Build Inspire Prompt`
- `Code: Extract Gemini Inspire`

Suggested files:

- `src/adapters/n8n/extract-gemini-fallback.adapter.ts`
- `src/adapters/n8n/build-inspire-prompt.adapter.ts`
- `src/adapters/n8n/extract-gemini-inspire.adapter.ts`

Required follow-up:

- Register them in `workflow/assemble.ts`
- Replace inline `jsCode` placeholders in `workflow/skeleton.json`
- Keep `workflow/assemble.test.ts` coverage for assembled workflow behavior
- Add direct adapter-level tests where parsing or normalization is non-trivial

Why this goes first:

- This is the biggest improvement to day-to-day iteration speed.
- It removes the most painful JSON-escaped code paths.
- It makes bugs like the recent Gemini wrapped-body issue easier to test and fix.

## 2. Split `resolve-editorial.ts` By Responsibility

`src/editorial/resolve-editorial.ts` should become a small coordinator over focused modules.

Suggested split:

- `src/editorial/editorial-types.ts`
  - shared types such as `BriefContext`, `WindowLike`, `SpurRaw`, `ResolveEditorialInput`
- `src/editorial/editorial-parse.ts`
  - `stripMarkdownFences`
  - `parseGroqResponse`
  - future provider-specific parsers
- `src/editorial/editorial-validate.ts`
  - `peakWindowHour`
  - `getValidationWindowContext`
  - `getFactualCheck`
  - `getEditorialCheck`
  - `shouldReplaceAiText`
- `src/editorial/editorial-composition.ts`
  - composition bullet filtering
  - specificity ranking
  - fallback composition bullets
- `src/editorial/editorial-week-standout.ts`
  - `validateWeekInsight`
  - `buildWeekStandoutFallback`
- `src/editorial/editorial-spur.ts`
  - `resolveSpurSuggestion`
  - `resolveSpurDropReason`
- `src/editorial/resolve-editorial.ts`
  - final orchestration only

Why this is second:

- This file is now the main “policy engine” for AI output.
- Most current editorial bugs land here.
- Smaller files will make it easier to change one rule set without risking unrelated behavior.

## 3. Reduce `format-messages.adapter.ts` To Workflow Orchestration

`src/adapters/n8n/format-messages.adapter.ts` should become a thin composition layer.

Suggested extraction:

- `src/adapters/n8n/normalize-ai-diagnostics.ts`
  - build the Gemini diagnostic object from raw node fields
- `src/adapters/n8n/hydrate-debug-context.ts`
  - metadata merge
  - payload snapshot insertion
  - long-range candidate normalization
- `src/adapters/n8n/render-outputs.ts`
  - render email, debug email, telegram, site, brief JSON

Target state:

- `format-messages.adapter.ts` should mostly:
  - read input
  - normalize diagnostics
  - call `resolveEditorial`
  - hydrate debug context
  - render outputs
  - return final node payload

Why this matters:

- This adapter is the final merge point for almost everything.
- Keeping it thin reduces regression risk whenever debug fields or rendering paths change.

## 4. Add Explicit Payload Contracts For n8n Boundaries

Introduce small typed contract modules for boundary payloads that are currently inferred ad hoc.

Suggested contracts:

- `src/adapters/n8n/contracts/http-response.ts`
  - wrapped HTTP node response shapes
  - buffered body / decoded body helpers
- `src/adapters/n8n/contracts/editorial-input.ts`
  - the input expected by editorial resolution
- `src/adapters/n8n/contracts/final-runtime-payload.ts`
  - the merged runtime payload before rendering/debug snapshotting

Benefits:

- Makes node boundary drift visible in TypeScript instead of only in debug output.
- Makes adapter tests easier to write and reason about.
- Reduces repeated “is this shape under `body`, `data`, or `response`?” logic.

## Recommended Execution Order

### Phase 1

- Move the 3 remaining inline Gemini-related nodes into adapters
- Keep behavior identical
- Add direct tests for buffered and wrapped Gemini response shapes

### Phase 2

- Split `resolve-editorial.ts` into parse / validate / composition / week-standout / spur modules
- Leave public behavior unchanged
- Keep `resolveEditorial()` as the stable entrypoint

### Phase 3

- Extract helper modules from `format-messages.adapter.ts`
- Keep the adapter as the top-level workflow coordinator

### Phase 4

- Add explicit contract modules for n8n boundary payloads
- Update tests to use the shared contracts/builders

## Guardrails

- Do not change workflow behavior while doing structural refactors unless a change is explicitly intended.
- Preserve the generated artifact flow:
  - `workflow/skeleton.json`
  - `workflow/photography-weather-brief.json`
- Keep assembled workflow tests for end-to-end node behavior.
- Add direct unit tests for each newly extracted adapter/helper where the logic is shape-sensitive or policy-heavy.

## Success Criteria

- No remaining high-churn logic lives as large inline `jsCode` blocks in `workflow/skeleton.json`
- `resolve-editorial.ts` is a small coordinator instead of a monolith
- `format-messages.adapter.ts` is orchestration-only
- Gemini and similar HTTP response parsing is testable without going through assembled workflow JSON
- Future debug-field additions require local helper edits, not broad cross-file changes

## Suggested First Ticket

**Modularize the remaining inline Gemini nodes**

Deliverables:

- New adapter files for fallback extraction, inspire prompt building, and inspire extraction
- `workflow/assemble.ts` updated to bundle them
- `workflow/skeleton.json` updated to use adapter placeholders
- `workflow/assemble.test.ts` updated
- Adapter-level tests added for wrapped and buffered Gemini payloads

This is the smallest change with the biggest immediate payoff.
