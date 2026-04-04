# n8n Adapter Primer

This folder is the runtime boundary between the application and n8n code nodes.

## Purpose

- normalize n8n input payloads
- read runtime config
- call one focused app or domain function per adapter
- shape outputs for downstream workflow nodes

## Entry patterns

- thin data-wrapping nodes such as [`wrap-weather.adapter.ts`](./wrap-weather.adapter.ts)
- scoring/editorial adapters such as [`score-hours.adapter.ts`](./score-hours.adapter.ts) and [`format-messages.adapter.ts`](./format-messages.adapter.ts)
- contract helpers under [`contracts/`](./contracts)

`format-messages.adapter.ts` is the single live finalization bridge. It maps n8n
payload/config into `finalizeBrief(...)` and returns the rendered outputs for
downstream workflow nodes. It is also the transport edge for editorial output:
the adapter extracts raw provider text/diagnostics from the workflow payload,
builds the stable `editorialGateway` contract, then hands that to the app
layer. Finalization orchestration does not live in adapter-only helper modules
anymore.

## What not to edit casually

- compatibility helpers in [`input.ts`](./input.ts) and [`types.ts`](./types.ts)
- runtime payload contracts under [`contracts/`](./contracts)
- generated workflow placeholder names expected by [`../../../workflow/build/assemble.ts`](../../../workflow/build/assemble.ts)

## Tests

- [`format-messages.adapter.test.ts`](./format-messages.adapter.test.ts)
- [`extract-gemini-fallback.adapter.test.ts`](./extract-gemini-fallback.adapter.test.ts)
- [`extract-gemini-inspire.adapter.test.ts`](./extract-gemini-inspire.adapter.test.ts)
- [`build-inspire-prompt.adapter.test.ts`](./build-inspire-prompt.adapter.test.ts)

## Working rule

If business logic starts to dominate an adapter, extract it into `src/app`, `src/domain`, or `src/presenters` and keep the adapter as plumbing.
