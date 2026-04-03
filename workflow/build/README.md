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

## What not to edit casually

- adapter placeholder names in [`assemble.ts`](./assemble.ts)
- the generated output locations without also updating tests and `package.json` verification scripts

## Tests

- [`../assemble.test.ts`](../assemble.test.ts)
- [`../generated-artifacts.test.ts`](../generated-artifacts.test.ts)
