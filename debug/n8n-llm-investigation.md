# n8n LLM Pipeline Investigation — 12 April 2026

## Executive Summary

**All three LLM paths are broken.** Groq has been failing with a 400 since at least April 6. Gemini Fallback intermittently 429s. Gemini Inspire has **never succeeded** in any examined execution. The workflow still "succeeds" because the template fallback catches everything, but editorial quality has degraded to generic, non-AI-generated text.

---

## Issue 1: Groq `json_schema` Not Supported (CRITICAL)

**Error:** `This model does not support response format 'json_schema'`

**Root cause:** The workflow sends `response_format.type = "json_schema"` with `strict: true` to `llama-3.3-70b-versatile`. Groq's structured outputs docs now only support `json_schema` on:
- `openai/gpt-oss-20b`
- `openai/gpt-oss-120b`
- `openai/gpt-oss-safeguard-20b`
- `meta-llama/llama-4-scout-17b-16e-instruct`

`llama-3.3-70b-versatile` is **not** in the supported list. This model only supports `json_object` mode (no schema enforcement).

**Evidence:** Every execution since at least April 6 shows this error. The April 6 error was slightly different ("Failed to validate JSON" — suggesting Groq previously attempted `json_schema` on this model in best-effort mode but has since removed support entirely).

**Workflow source:** `HTTP: Groq` node body expression:
```js
const structured = $json.editorialPromptMode === 'structured-output';
// When structured=true → sends json_schema (BROKEN)
// When structured=false → sends json_object (would work)
```

### Fix Options

| Option | Change | Pros | Cons |
|--------|--------|------|------|
| A. Switch `editorialPromptMode` to `legacy` | Config change only | Instant fix, uses `json_object` mode | No schema enforcement, needs retry logic for malformed JSON |
| B. Change Groq model to `meta-llama/llama-4-scout-17b-16e-instruct` | Workflow model field | Keeps `json_schema` strict mode | Different model, may need prompt tuning |
| C. Change Groq model to `openai/gpt-oss-20b` | Workflow model field | Full strict mode support, recommended by Groq | Different model family, prompt tuning needed |
| D. Replace Groq with OpenRouter | Architecture change | Single provider, model flexibility | Bigger change, already planned per `docs/openrouter-migration.md` |

**Recommended:** Option B (`llama-4-scout-17b-16e-instruct`) for a quick fix. It supports `json_schema` with `strict: true`, is a newer Llama model, and is on Groq's free tier. Follow up with the planned OpenRouter migration when ready.

---

## Issue 2: Gemini 429 Rate Limiting (HIGH)

**Error:** `Request failed with status code 429`

**Root cause:** Gemini Fallback and Gemini Inspire fire in rapid succession. When Groq fails (which is every time now), the fallback chain runs as:

```
Groq fails (instant 400)
  → Inspect Groq → needFallback=true
    → Gemini Fallback fires (takes ~25s)
      → Gemini Inspire fires (~80ms after Fallback completes)
        → 429 RATE LIMITED (always)
```

The Gemini free tier has strict per-minute rate limits. Two calls within seconds of each other triggers the limit.

**Pattern across executions:**

| Exec | Date | Groq | Gemini FB | Gemini Inspire |
|------|------|------|-----------|----------------|
| 2112 | Apr 12 | 400 | **429** | 429 |
| 2097 | Apr 11 | 400 | **429** | 429 |
| 2072 | Apr 9 (pm) | 400 | **200** | 429 |
| 2058 | Apr 9 (am) | 400 | **200** | 429 |
| 1995 | Apr 6 | 400 | **200** | 429 |

**Key observations:**
- Gemini Inspire has **never succeeded** in any examined execution — it always 429s
- Gemini Fallback was working until April 10, then started 429ing too
- This suggests the free-tier rate limits may have tightened, or previous calls in other workflows are consuming quota

**Gemini Inspire node config issues:**
- `retryOnFail: false` — no retries at all
- No delay/backoff between Fallback and Inspire requests
- No batching or spacing configured in n8n options

### Fix Options

| Option | Change | Impact |
|--------|--------|--------|
| Add delay between Gemini calls | Insert a Wait node (30-60s) before Inspire | Avoids rate limit |
| Enable retry with backoff on Inspire | Set `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 30000` | Handles transient 429s |
| Upgrade to Gemini paid tier | Google AI Studio billing | Removes rate limit concern entirely |
| Consolidate to one Gemini call | Merge Fallback + Inspire into a single request | Halves API calls |

**Recommended:** Add a 30–60s Wait node before `HTTP: Gemini Inspire`, and enable retries on both Gemini nodes. If Fallback is now also 429ing consistently, a longer delay or paid tier upgrade is needed.

---

## Issue 3: Template Fallback Quality (MEDIUM)

When all LLMs fail, the workflow uses a hardcoded template fallback. The delivered editorial for today (execution 2112):

```
aiText: "Best conditions are around 20:00 in the evening golden hour.
Peak astro sub-score reaches 78/100 around 23:00, after darker
conditions begin at 01:00; the named window itself tops out at 64/100."

compositionBullets: [
  "Find a clean horizon — lone tree, church spire, or ridge silhouette — and let the low sun do the work around 20:00.",
  "Side-light picks out every texture; get close to walls, bark, or dry stone for warm, raking detail."
]

weekInsight: "Today is the standout day."
```

**Debug context confirms:** `selectedProvider: "template"`, `primaryRejectionReason: "Gemini response — response received (1677 bytes) but no Gemini text was extracted"`

This template text is generic and doesn't reference specific Leeds landmarks, current aurora/visibility conditions, or the spur-of-the-moment location. The whole editorial pipeline has been delivering template fallback for at least 2 days straight.

---

## Recommended Action Plan

### Immediate (fix today)
1. **Change Groq model** to `meta-llama/llama-4-scout-17b-16e-instruct` in the `HTTP: Groq` node body. This restores `json_schema` support.
2. **Add retry + delay on Gemini Inspire**: Set `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 30000`.

### Short-term (this week)
3. **Add a Wait node** (30–60s) between `HTTP: Gemini Fallback` completion and `HTTP: Gemini Inspire` start.
4. **Add retry on Gemini Fallback**: Increase `maxTries` from 2 to 3, `waitBetweenTries` from 3000 to 15000 (Gemini 429 needs longer backoff than 3s).

### Medium-term
5. **Complete OpenRouter migration** (per `docs/openrouter-migration.md`) — single provider with model fallback, proper rate limiting, and cost tracking.
6. **Add execution monitoring** — alert when template fallback is used for >1 consecutive day.

---

## Raw Data Saved

- `/tmp/n8n-exec-{2112,2097,2072,2058,1995}.json` — full execution payloads
- `/tmp/gemini-fallback-decoded.json` — decoded Gemini response (exec 2072)
- `/tmp/gemini-fallback-text.json` — parsed Gemini editorial JSON (exec 2072)
- `/tmp/build-prompt-output.json` — full prompt input (system + user + schema)
