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
- primary editorial inspection via [`inspect-groq-primary.adapter.ts`](./inspect-groq-primary.adapter.ts)
- prompt shaping and rollout selection via [`build-prompt.adapter.ts`](./build-prompt.adapter.ts)

`format-messages.adapter.ts` is the single live finalization bridge. It maps n8n
payload/config into `finalizeBrief(...)` and returns the rendered outputs for
downstream workflow nodes. It is also the transport edge for editorial output:
the adapter extracts raw provider text/diagnostics from the workflow payload,
builds the stable `editorialGateway` contract, then hands that to the app
layer. Finalization orchestration does not live in adapter-only helper modules
anymore.

The workflow now inspects the Groq primary response before calling Gemini
fallback. `inspect-groq-primary.adapter.ts` preserves the Groq `choices`
payload for finalization, emits transport diagnostics, and flags clearly
unusable primary results (HTTP error/rate limit, empty content, malformed
structured output) so the workflow only pays for fallback when it needs to.

`build-prompt.adapter.ts` now emits both prompt styles needed by the workflow:

- legacy `prompt` for the existing JSON-in-prompt route
- structured `systemPrompt` / `userPrompt` plus `responseSchema` metadata for the Groq schema-enforced route

The workflow chooses between them with `editorialPromptMode` (`legacy-json` or `structured-output`). The default comes from the `PHOTO_BRIEF_EDITORIAL_PROMPT_MODE` secret and can be overridden per webhook request with `editorialPromptMode` in the body or query string.

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
