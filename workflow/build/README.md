# Workflow Build Primer

This folder contains the build-time tooling for generated workflow artifacts.

## Purpose

- compile MJML email templates into TypeScript fragments
- bundle n8n adapters into runnable code-node payloads
- assemble the committed workflow artifact from the source skeleton

## Files

- [`compile-email.ts`](./compile-email.ts)
  Compiles [`../../src/presenters/email/templates.ts`](../../src/presenters/email/templates.ts) into [`../../src/presenters/email/compiled-layout.generated.ts`](../../src/presenters/email/compiled-layout.generated.ts).
- [`assemble.ts`](./assemble.ts)
  Reads [`../source/skeleton.json`](../source/skeleton.json), bundles adapters, and writes [`../../generated/workflow/photography-weather-brief.json`](../../generated/workflow/photography-weather-brief.json).
- [`verify-generated.ts`](./verify-generated.ts)
  Rebuilds generated artifacts in memory and diffs against committed files. Exits non-zero if any are stale. Run via `npm run verify:generated`.

## What not to edit casually

- adapter placeholder names in [`assemble.ts`](./assemble.ts)
- the generated output locations without also updating tests and `package.json` verification scripts

The workflow skeleton now contains a conditional editorial branch:

- `HTTP: Groq` runs first in full-response mode
- `Code: Inspect Groq Primary` decides whether fallback is required
- `HTTP: Gemini Fallback` only runs when the primary response is clearly unusable
- app-layer template fallback remains the final safety net after the workflow edge

The inspire chain is gated behind a feature flag:

- `If: Run Inspire` checks `inspireEnabled` from config (defaults to `true`)
- When enabled: `Code: Build Inspire Prompt` → `HTTP: Gemini Inspire` → `Code: Extract Gemini Inspire`
- When disabled: `NoOp: Skip Inspire` bypasses the API call; downstream code handles missing inspire content

## Tests

- [`../assemble.test.ts`](../assemble.test.ts)
- [`../generated-artifacts.test.ts`](../generated-artifacts.test.ts)
