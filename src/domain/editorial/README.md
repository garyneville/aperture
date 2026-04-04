# Editorial Primer

This folder owns prompt assembly and editorial resolution for the photography brief.

## Purpose

- turn scored forecast context into an editorial prompt
- parse provider responses
- validate factual and stylistic quality
- choose fallbacks when provider output is weak
- normalize composition bullets, week standout text, and spur suggestions

## Public entrypoints

- [`prompt/build-prompt.ts`](./prompt/build-prompt.ts)
  Builds the provider prompt and returns the enriched scoring context used by editorial resolution.
- [`resolution/resolve-editorial.ts`](./resolution/resolve-editorial.ts)
  Canonical resolver for provider choice, validation, fallback text, and debug trace output. Consumes the stable `EditorialGatewayPayload` rather than raw transport shapes.
- [`resolution/parse.ts`](./resolution/parse.ts)
  Provider-neutral response parsing. Use `parseEditorialResponse()` for new code; `parseGroqResponse()` is kept for backward compatibility.
- [`../../contracts/editorial.ts`](../../contracts/editorial.ts)
  Stable re-export surface for external callers.

## Flow

1. Prompt construction happens in [`prompt/build-prompt.ts`](./prompt/build-prompt.ts).
2. Shared prompt blocks (response contract, spur instructions, week standout) live in [`prompt/sections/prompt-blocks.ts`](./prompt/sections/prompt-blocks.ts) and [`prompt/sections/week-standout.ts`](./prompt/sections/week-standout.ts).
3. Provider JSON/text parsing happens in [`resolution/parse.ts`](./resolution/parse.ts) via `parseEditorialResponse()` — a provider-neutral parser that handles responses from any AI provider (Groq, Gemini, etc.) without tying the code to specific provider naming.
4. The runtime/app edge uses that parser to build an `EditorialGatewayPayload` with normalized text, raw text, parse outcome, diagnostics, and API status metadata.
5. Factual/editorial checks live in [`resolution/validation.ts`](./resolution/validation.ts).
6. Composition filtering lives in [`resolution/composition.ts`](./resolution/composition.ts).
7. Week-standout and spur logic live in [`resolution/week-standout.ts`](./resolution/week-standout.ts) and [`resolution/spur-suggestion.ts`](./resolution/spur-suggestion.ts).
8. [`resolution/resolve-editorial.ts`](./resolution/resolve-editorial.ts) orchestrates those pieces and produces the final editorial decision.

## What not to edit casually

- Provider fallback rules in [`resolution/resolve-editorial.ts`](./resolution/resolve-editorial.ts)
- Validation heuristics in [`resolution/validation.ts`](./resolution/validation.ts)
- Output contract types re-exported from [`../../contracts/editorial.ts`](../../contracts/editorial.ts)

## Tests

- [`prompt/build-prompt.test.ts`](./prompt/build-prompt.test.ts)
- [`../../adapters/n8n/format-messages.adapter.test.ts`](../../adapters/n8n/format-messages.adapter.test.ts)
