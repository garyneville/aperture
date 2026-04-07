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

## Weather API design notes

The skeleton uses two separate Open-Meteo forecast calls with different model strategies:

- **`HTTP: Weather`** pins `models=ukmo_seamless` for deterministic fields (cloud cover, visibility, wind, temperature, etc.). UKMO provides high-resolution UK-focused forecasts.
- **`HTTP: Precip Prob`** omits the `models` parameter so the API uses its default best-match model. The UKMO model does not support `precipitation_probability` (it returns `null` for every hour); the best-match model provides real probability values from ensemble sources.

If a new hourly field is needed, check whether the chosen model supports it before adding it to a URL. Fields unsupported by a model return `null` arrays.

### UKMO-incompatible fields

The following fields are **not** requested in the `HTTP: Weather` node because `ukmo_seamless` returns `null` for them:

| Field | Scoring fallback | Impact |
|---|---|---|
| `precipitation_probability` | Served by `HTTP: Precip Prob` (no model pin) | Real values via best-match model |
| `lightning_potential` | Served by `HTTP: Precip Prob` (no model pin) | Real values via best-match model; gated by CAPE ≥ 500 J/kg floor before use |
| `total_column_integrated_water_vapour` | Falls back to 20 (neutral — no clarity bonus or penalty) | Scoring degraded; real values would improve clarity assessment |
| `boundary_layer_height` | Served by `HTTP: ECMWF Supplement` (ECMWF IFS 0.25°) | Real values enable inversion/mist scoring |
| `soil_temperature_0cm` | Served by `HTTP: ECMWF Supplement` (ECMWF IFS 0.25°) | Real values enable frost detection (`hasFrost`) |

Alt-location (`prepare-alt-locations.ts`) and long-range (`prepare-long-range.ts`) URLs also pin `models=ukmo_seamless`, so their `HOURLY_FIELDS` arrays must likewise exclude UKMO-incompatible fields. Precipitation probability scoring for these locations degrades gracefully — the field is optional in their scoring contracts.

### ECMWF Supplement — boundary_layer_height & soil_temperature_0cm

The skeleton includes an `HTTP: ECMWF Supplement` node that fetches `boundary_layer_height` and `soil_temperature_0cm` from ECMWF IFS 0.25° via the Open-Meteo ECMWF endpoint:

```
https://api.open-meteo.com/v1/ecmwf?latitude=...&longitude=...&hourly=soil_temperature_0cm,boundary_layer_height&models=ecmwf_ifs025&timezone=...&forecast_days=5
```

The response is wrapped by `Code: Wrap ECMWF Supplement` and merged into the score input chain via `Merge: Score Input 9`. The `build-score-input` adapter aligns ECMWF timestamps to the primary weather time axis and merges the two fields into the weather object, so `summarize-day.ts` reads them transparently. When the ECMWF fetch fails or returns empty data, the fields degrade gracefully — `boundary_layer_height` falls back to `null` (mist scoring via dew-point spread only) and `soil_temperature_0cm` falls back to `null` (`hasFrost` returns `null`).

The workflow skeleton now contains a conditional editorial branch:

- `HTTP: Groq` runs first in full-response mode
- `Code: Inspect Groq Primary` decides whether fallback is required
- `HTTP: Gemini Fallback` only runs when the primary response is clearly unusable
- `Merge: Prompt + Gemini FB` combines the prompt context with the extracted Gemini fallback response before routing to `Merge: Editorial Route`
- app-layer template fallback remains the final safety net after the workflow edge

The inspire chain is gated behind a feature flag:

- `If: Run Inspire` checks `inspireEnabled` from config (defaults to `true`)
- When enabled: `Code: Build Inspire Prompt` → `HTTP: Gemini Inspire` → `Code: Extract Gemini Inspire`
- When disabled: `NoOp: Skip Inspire` bypasses the API call; downstream code handles missing inspire content

### Marine API

The skeleton includes an `HTTP: Marine` node that fetches hourly wave data from the Open-Meteo Marine API (`marine-api.open-meteo.com/v1/marine`). The response is wrapped by `Code: Wrap Marine` and merged into the score input chain via `Merge: Score Input 8`. Fields fetched: `wave_height`, `wave_direction`, `wave_period`, `wave_peak_period`. When the marine fetch fails or returns empty data, scoring degrades gracefully — the seascape evaluator returns score 0 with a diagnostic warning.

## Tests

- [`../assemble.test.ts`](../assemble.test.ts)
- [`../generated-artifacts.test.ts`](../generated-artifacts.test.ts)
