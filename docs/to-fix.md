# Aperture — Fix & Improve Plan

Findings from pipeline analysis on 6 Apr 2026. Organised into four phases: unblock editorial first, then fill data gaps, then improve scoring signals, then polish presentation.

---

## Phase 1 — Unblock editorial (both providers failing)

Both AI providers failed on 6 Apr, leaving the brief on template fallback. This is the only phase that affects every single run.

### 1a. Gemini MAX_TOKENS truncation
Gemini `gemini-3-flash-preview` uses thinking tokens (1,532) that compete with the `maxOutputTokens: 1600` budget. Only 64 candidate tokens were generated before truncation — the editorial was cut off mid-sentence. Finish reason: `MAX_TOKENS`.

**Fix:** Increase `maxOutputTokens` in `workflow/source/skeleton.json` (currently 1600 for editorial, 800 for inspire) to ~4000, or disable thinking via `thinkingConfig` if the Gemini API supports it, or switch to a non-thinking model variant.

### 1b. Groq returns empty response
The primary editorial provider returned nothing: `Raw Groq response: (empty)`. Combined with Gemini truncation, both providers failed.

**Fix:** Add diagnostics — log the Groq HTTP status and raw response body in the debug trace when `empty-response` triggers. Check whether the model `openai/gpt-oss-120b` is still available on Groq. Consider testing with `llama-3.3-70b-versatile` as a known-good fallback model.

### 1c. AuroraWatch UK API persistently 404
`https://aurorawatch.lancs.ac.uk/api/0.1/status/` returned 404 in all snapshots. Not intermittent — the endpoint appears down or moved.

**Fix:** Check whether AuroraWatch has migrated to a new API version. Add a warning in `fuseAuroraSignals()` when the AuroraWatch signal is missing (currently silent). Ensure the remaining two aurora signals (Kp + DONKI CME) still produce a usable fused result when AuroraWatch is absent.

---

## Phase 2 — Fill data gaps (unlock null features)

Several scoring features are permanently null because the API calls don't request the fields. These are small changes to API URLs (workflow skeleton + snapshot script) with immediate scoring benefit.

### 2a. Add `direct_radiation` and `diffuse_radiation` to weather API call
Currently null for all hours. The `diffuseToDirectRatio` feature falls back to a cloud-cover heuristic. UKMO on Open-Meteo supports both fields. Adding them improves golden-hour, wildlife, and long-exposure scoring precision.

**Change:** Add `direct_radiation,diffuse_radiation` to the UKMO hourly parameter list in:
- `workflow/source/skeleton.json` (the weather HTTP node)
- `scripts/snapshot-apis.sh` (API 01)

### 2b. Add `soil_temperature_0cm` to weather API call
Currently null, so `hasFrost` can never trigger. UKMO provides this. Enables frost detection (moody dawn shots, frost-on-cobweb compositions).

**Change:** Add `soil_temperature_0cm` alongside the radiation fields above.

### 2c. Source `boundary_layer_height` from a secondary model
Not available from UKMO. Open-Meteo provides it from ECMWF and GFS. Would improve mist/inversion scoring.

**Change:** Either add a secondary ECMWF hourly call for `boundary_layer_height` only, or accept the null and document the limitation. Lower priority than 2a/2b since mist scoring already works via dew-point spread.

---

## Phase 3 — Improve scoring signals & debug clarity

These address inconsistencies in scoring presentation, confidence calibration, and recommendation gating.

### 3a. Investigate score gap: pipeline 51 vs email 64
The email shows PM: 64, Overall: 64 for today, but the pipeline dump shows `pmScore=51` and the 20:00 hour raw score is 51. A 13-point gap needs explaining — is there a post-scoring transformation, SunsetHue boost applied after `scoreAllDays()`, or purely a temporal forecast shift between the two runs?

**Action:** Trace the data path from `scoreAllDays()` output through to `BriefRenderInput` to find where the score diverges. Document the transformation if intentional.

### 3b. Clarify "best session" vs "best window" in debug email
Debug email says "Best session: Long Exposure (81/100 at 06:00)" while the main email promotes "Evening golden hour: 20:00 at 64/100". The 64 is an *hourly composite* score, not the golden-hour *session* score (which is 29). The time-aware window system correctly skips the past 06:00 window, but the debug email reports the raw session max without time-awareness.

**Fix:** Either make the debug email's "Best session today" line time-aware (matching the main email's window selection logic), or annotate it clearly as "Best session (any time)" to avoid confusion.

### 3c. Recalibrate confidence bands
All 5 days show `confidence: low` (spreads 31–39). When everything is "low", the signal is noise. Current thresholds: High <12, Fair 12–24, Low ≥25.

**Fix:** Add a fourth band (e.g., "Very Low" ≥35) or shift the thresholds upward to match typical UK ensemble spread ranges. Alternatively, express confidence as a relative signal ("more reliable than tomorrow" / "least reliable day this week") rather than absolute.

### 3d. Gate long-range astro recommendations on moon phase + confidence
Kielder Forest (170-min drive) was recommended for astro at 23:00 with 79% moon illumination and low confidence. That's a tough sell.

**Fix:** Add a gate in long-range scoring: suppress astro-driven long-range recommendations when `moonPct > 60%` AND `confidence === 'low'`. Keep the location visible in debug but don't promote it in the main email.

---

## Phase 4 — Presentation polish

Lower-priority refinements to template quality, comfort labels, and unnecessary API calls.

### 4a. Context-aware fallback composition bullets
When AI fails, the composition bullets are generic ("Use a lone tree, church tower, or ridge break…"). The fallback generator has access to scored context (cloud %, sun direction, visibility, window type) but doesn't use it for shot ideas.

**Fix:** In `buildFallbackAiText()` or a companion function, select from a pool of pre-written bullets keyed by conditions: clear-sky golden hour → horizon/silhouette suggestions with sun direction; overcast → diffuse-light subjects; astro → dark-sky framing. Even 3–4 condition buckets would outperform the current one-size-fits-all.

### 4b. Differentiate outdoor comfort labels
Every hour from 14:00–22:00 shows "Best for a run" at 95–100/100. When conditions are uniformly good, the identical labels become filler.

**Fix:** Either collapse uniform runs into a single range ("14:00–22:00: excellent conditions"), or add time-of-day variation ("lunch walk" / "evening run" / "after-dark stroll").

### 4c. Skip marine API call for inland locations
Leeds is inland — all marine data returns null. The API call is unnecessary overhead.

**Fix:** Add an `isCoastal` flag to location config (or compute distance-to-coast) and skip the marine fetch when false. Seascape is already correctly gated, so no scoring change needed.

### 4d. Creative spark constraints (low priority)
The inspire chain referenced "Malham Cove" — a nearby alternative. The editorial rules say "Leeds conditions only", but this constraint applies to the `editorial` field, not the creative spark. The inspire prompt intentionally receives alt-location names for poetic use.

**Action:** Decide whether the creative spark *should* be allowed to mention alternatives. If yes, document the distinction. If no, filter alt-location names from the inspire prompt input.

---

## Summary

| Phase | Items | Theme | Risk if skipped |
|-------|-------|-------|-----------------|
| **1** | 1a, 1b, 1c | Unblock editorial providers | Every run falls back to templates |
| **2** | 2a, 2b, 2c | Fill null API fields | Scoring features permanently disabled |
| **3** | 3a, 3b, 3c, 3d | Scoring signals & debug clarity | Confusing debug output, noisy confidence |
| **4** | 4a, 4b, 4c, 4d | Presentation polish | Generic fallbacks, minor UX issues |