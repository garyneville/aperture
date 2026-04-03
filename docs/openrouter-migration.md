# OpenRouter Migration for Editorial Models

This note describes how to move `aperture` from the current `Groq + Gemini` editorial setup to OpenRouter, using:

- primary model: `meta-llama/llama-3.3-70b-instruct:free`
- fallback model: `google/gemma-3-12b:free`
- final fallback: the existing built-in template fallback already in the app

The goal is to reduce provider-specific maintenance, simplify credentials, and handle rate limits more cleanly.

## Current State

Today the workflow has three AI calls in `workflow/source/skeleton.json`:

- `HTTP: Groq` for the main editorial JSON response
- `HTTP: Gemini Fallback` for the secondary editorial candidate
- `HTTP: Gemini Inspire` for the optional creative spark text

Those responses feed into the app-layer finalizer through `src/adapters/n8n/format-messages.adapter.ts`.

Important constraint: the app currently models the two editorial providers as logical slots named `groq` and `gemini`, not as generic `primary` and `secondary`:

- `src/app/run-photo-brief/contracts.ts`
- `src/domain/editorial/resolution/resolve-editorial.ts`
- `src/domain/editorial/resolution/candidate-selection.ts`
- `src/lib/debug-context.ts`

That means the cleanest migration path is to treat those names as temporary slot labels during the migration, rather than doing a full refactor first.

## Recommendation

Use a staged approach.

### Stage 1: Minimal-risk migration

Keep the app contracts as they are and swap the transport/provider underneath them.

- Map the current `groq` slot to OpenRouter primary
- Map the current `gemini` slot to OpenRouter secondary
- Keep the existing template fallback in `resolveEditorial(...)`

In practice this means:

- `preferredProvider = 'groq'` still means "use the primary slot first"
- the primary slot will now call OpenRouter instead of Groq
- the secondary slot will now call OpenRouter instead of Gemini

This avoids a large app-layer rename while letting you switch providers quickly.

### Stage 2: Clean-up refactor

Once the workflow is stable, rename the internal provider model from `groq/gemini` to `primary/secondary` or `openrouterPrimary/openrouterFallback`.

That refactor would touch:

- `src/app/run-photo-brief/contracts.ts`
- `src/app/run-photo-brief/finalize-brief-contracts.ts`
- `src/app/run-photo-brief/finalize-brief.ts`
- `src/domain/editorial/resolution/*`
- `src/lib/debug-context.ts`
- adapter payload types and debug output labels

Do not start with this. It is a nice-to-have after the transport swap works.

## Best Rate-Limit Strategy

Do not keep the current "always call both models" pattern if rate limits are already the problem.

The current workflow effectively makes:

- 1 primary editorial call
- 1 fallback editorial call
- 1 inspire call

per run.

That is simple, but it burns free-tier capacity quickly.

For OpenRouter, the better design is:

1. Call the primary model first
2. Only call the fallback model if the primary call fails, is rate-limited, returns empty text, or returns invalid/unusable JSON
3. Treat the inspire call as optional and do not let it block the brief
4. If both editorial calls fail, let the existing template fallback produce the brief

That gives you three levels of resilience:

1. OpenRouter primary model
2. OpenRouter secondary model
3. Existing template fallback in app code

## Model Choice

### Primary

Use:

```text
meta-llama/llama-3.3-70b-instruct:free
```

Why:

- best fit for the repo's strict prompt-following and short structured JSON output
- strong enough for two-sentence editorial plus composition bullets
- OpenAI-compatible response shape through OpenRouter

### Secondary fallback

Use:

```text
google/gemma-3-12b:free
```

Why:

- lighter and usually easier to justify as a fallback than another very large free model
- still good enough for structured JSON output
- better fit for a fallback than a more elaborate creative model

I would not use `nousresearch/hermes-3-405b-instruct:free` as the default fallback here if the main pain is rate limits. It is better suited to premium copy polishing than to being your backup workhorse.

### Inspire model

For the optional inspire branch, you have two good choices:

- simplest: reuse `google/gemma-3-12b:free`
- safest: disable the inspire call temporarily until the main editorial path is stable

The inspire branch is not critical to brief correctness. The site and email can already function without it.

## Minimal Migration Plan

This is the fastest way to move without rewriting the app layer.

### 1. Replace the Groq HTTP node with OpenRouter primary

In `workflow/source/skeleton.json`, replace `HTTP: Groq` with an OpenRouter call:

- URL: `https://openrouter.ai/api/v1/chat/completions`
- Method: `POST`
- Headers:
  - `Authorization: Bearer __OPENROUTER_API_KEY__`
  - `Content-Type: application/json`
- Body:

```json
{
  "model": "meta-llama/llama-3.3-70b-instruct:free",
  "messages": [
    {
      "role": "user",
      "content": "{{$json.prompt}}"
    }
  ],
  "temperature": 0.4,
  "max_tokens": 800,
  "response_format": { "type": "json_object" }
}
```

This preserves the OpenAI-style `choices[0].message.content` shape that the current app already uses for the `groq` slot.

### 2. Replace Gemini fallback with OpenRouter fallback

Replace `HTTP: Gemini Fallback` with another OpenRouter `chat/completions` call using:

```text
google/gemma-3-12b:free
```

Use the same body pattern as the primary node.

Important: the fallback branch should no longer use the Gemini-specific payload extractor because OpenRouter returns OpenAI-style chat completions, not Gemini `candidates[].content.parts[]`.

### 3. Add a new OpenRouter fallback extractor

Add a new adapter, for example:

```text
src/adapters/n8n/extract-openrouter-fallback.adapter.ts
```

Its job should be to read the OpenRouter HTTP response and emit fields matching the existing secondary slot contract expected by `format-messages.adapter.ts`, for example:

- `geminiResponse`
- `geminiRawPayload`
- `geminiStatusCode`
- `geminiResponseByteLength`
- `geminiRetryAfter`

This is intentionally a compatibility shim.

The app does not care that the secondary slot came from Gemini specifically. It only needs:

- raw text for the second editorial candidate
- enough diagnostics to explain fallback/rate-limit behavior in debug output

### 4. Replace Gemini inspire with OpenRouter inspire or disable it

If you keep the inspire branch, replace `HTTP: Gemini Inspire` with OpenRouter and add a second extractor such as:

```text
src/adapters/n8n/extract-openrouter-inspire.adapter.ts
```

It should emit:

- `geminiInspire`

Again, this keeps the app contract stable while changing the transport underneath.

If rate limits are the immediate pain point, disabling the inspire call first is a perfectly reasonable move.

### 5. Keep `PHOTO_BRIEF_EDITORIAL_PRIMARY_PROVIDER=groq` for now

This is counterintuitive but pragmatic.

Because the primary slot still flows through the current `choices` path, leave:

```text
PHOTO_BRIEF_EDITORIAL_PRIMARY_PROVIDER=groq
```

for the first migration pass.

That means:

- primary slot = current `groq` logical path = OpenRouter Llama 3.3 free
- secondary slot = current `gemini` logical path = OpenRouter Gemma 3 free

Once the system is stable, you can refactor the code to stop using the provider names as slot labels.

## Better Workflow Design

The better long-term n8n design is not parallel primary+fallback. It is conditional fallback.

Recommended flow:

1. `Code: Build Prompt`
2. `HTTP: OpenRouter Primary`
3. `Code` or `IF`: inspect primary response
4. If primary is usable, merge into finalization input
5. If primary failed, call `HTTP: OpenRouter Fallback`
6. Merge finalization input
7. `Code: Format Messages`

Usable primary response means:

- HTTP 200
- `choices[0].message.content` exists and is non-empty
- ideally parses as JSON or at least starts with `{`

You do not need perfect parsing in n8n because `resolveEditorial(...)` already validates the result. You only need enough gating to avoid wasting the fallback call when the primary clearly succeeded.

## Suggested n8n Response Checks

Primary should trigger fallback when any of these are true:

- HTTP 429
- HTTP >= 500
- empty `choices[0].message.content`
- malformed JSON content

Nice improvement:

- if OpenRouter returns a `retry-after` header, pass it through diagnostics and optionally add a short `Wait` node before retrying the fallback path

## What Changes In Code

### Workflow files

Update:

- `workflow/source/skeleton.json`
- `workflow/build/assemble.ts`
- `workflow/build/assemble.test.ts`

Add placeholders if you want them configurable through the workflow artifact:

- `__OPENROUTER_API_KEY__`
- `__OPENROUTER_PRIMARY_MODEL__`
- `__OPENROUTER_FALLBACK_MODEL__`
- `__OPENROUTER_INSPIRE_MODEL__`

If you want the fastest possible migration, hardcoding the model IDs in the workflow first is fine.

### Adapter files

Keep:

- `src/adapters/n8n/format-messages.adapter.ts`

Replace or add:

- `src/adapters/n8n/extract-openrouter-fallback.adapter.ts`
- `src/adapters/n8n/extract-openrouter-inspire.adapter.ts`

Those adapters should be compatibility shims so that the finalizer still receives:

- primary text in `choices`
- secondary text in `geminiResponse`
- optional inspire text in `geminiInspire`

### App/domain files

No functional changes are required for the first pass if you keep the compatibility shape.

That is the main reason this migration is attractive.

## Clean Refactor After Migration

After the OpenRouter version is live and stable, a cleaner model would be:

- rename `EditorialProvider` from `'groq' | 'gemini'` to `'primary' | 'secondary'`
- rename `rawGroqResponse` / `rawGeminiResponse` to generic slot names
- rename `DebugGroqDiagnostics` / `DebugGeminiDiagnostics` to generic provider diagnostics
- update debug email labels so the debug output says `OpenRouter primary` and `OpenRouter fallback`

That refactor improves clarity but is not needed to solve rate limits.

## Rollout Plan

### Option A: Lowest-risk rollout

1. Swap `HTTP: Groq` to OpenRouter Llama 3.3 free
2. Leave fallback and inspire alone temporarily
3. Verify output quality and rate-limit behavior
4. Move fallback to OpenRouter Gemma 3 12B free
5. Move or disable inspire

### Option B: Best operational result

1. Swap primary to OpenRouter Llama 3.3 free
2. Replace fallback with OpenRouter Gemma 3 12B free
3. Make fallback conditional instead of always-on
4. Disable inspire until primary path is stable
5. Re-enable inspire only if it is worth the extra request volume

I recommend Option B.

## Final Recommendation

For `aperture`, the best practical setup is:

- primary editorial: `meta-llama/llama-3.3-70b-instruct:free`
- secondary editorial fallback: `google/gemma-3-12b:free`
- final fallback: existing template fallback in `resolveEditorial(...)`
- inspire branch: optional, and not on the critical path

If the only thing you do differently from today is this, make it this:

> Stop calling the fallback model on every run. Call it only when the primary model fails or returns unusable output.

That change will do more for rate-limit pain than swapping model IDs alone.
