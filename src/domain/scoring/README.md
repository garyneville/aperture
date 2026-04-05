# Scoring Primer

This folder owns weather feature derivation, day scoring, and session recommendations.

## Purpose

- derive scoring features from hourly forecast input
- score each hour and summarize each day
- rank built-in photography sessions across the forecast window

## Public entrypoints

- [`score-all-days.ts`](./score-all-days.ts)
  Main scoring orchestrator for hourly and daily outputs.
- [`features/derive-hour-features.ts`](./features/derive-hour-features.ts)
  Shared derived-feature seam used by the session evaluators.
- [`sessions/index.ts`](./sessions/index.ts)
  Built-in session evaluators, cross-hour selection, and recommendation summary.
- [`../../contracts/scored-forecast.ts`](../../contracts/scored-forecast.ts)
  Shared scored-forecast contract surface for callers.

## Working structure

- `features/`
  Hour-level feature engineering.
- `sessions/`
  Session evaluation and recommendation logic.
- `nowcast/`
  Near-term (0-6h) nowcast signal computation. Currently supports satellite radiation clearing/thickening detection via Open-Meteo Satellite Radiation API (EUMETSAT).
- `score-all-days.ts`
  Orchestrates hourly scoring, day summaries, debug payload assembly, and session recommendation attachment.

## Defensive guards

- `summarize-day.ts` coalesces `null` AirQualityData into static fallbacks (AOD: 0.2, AQI: 25, Dust: 0, UV: 0) and issues console warnings so that downstream feature math survives the shorter Open-Meteo Air Quality forecast horizon.
- `summarize-day.ts` resolves `precipitation_probability` from the dedicated `PrecipProbData` input (fetched without a model pin so the API's best-match model provides real values). The main weather response does not carry this field.
- `summarize-day.ts` resolves `lightning_potential` from the same `PrecipProbData` input (also requires best-match model; not supported by UKMO `ukmo_seamless`). A **CAPE < 500 J/kg hard floor** is applied before the value is propagated as `lightningRisk`: in UK/Northern Europe mid-latitude conditions, lightning risk is effectively zero below this CAPE threshold, and gating prevents false-positive storm scores on calm photogenic days with incidental cloud.
- `summarize-day.ts` falls back to 20 for `total_column_integrated_water_vapour` and `null` for `boundary_layer_height` when absent. The UKMO model does not support these fields, so they are not requested in the Weather node URL.
- `summarize-day.ts` extracts `direct_radiation`, `diffuse_radiation`, and `soil_temperature_0cm` from the weather response. These degrade to `null` when absent (e.g. if the model does not provide them), and derived features fall back gracefully.
- `summarize-day.ts` guards `crepRayPeak` against empty `hours` arrays (`Math.max(0, ...)` floor).
- `sessions/evaluators/golden-hour.ts` applies a humidity haze penalty when RH exceeds 70% — hygroscopic aerosol swelling in humid air creates milky haze that mutes sunset colour vibrancy.
- `sessions/evaluators/golden-hour.ts` weights cloud-stratification (high-cloud translucency, low-cloud blocking) more heavily than total cloud percentage, reflecting research that cloud altitude distribution matters more than total cover for sunset colour.
- `sessions/evaluators/wildlife.ts` uses the physics-based `diffuseToDirectRatio` for soft-light scoring when radiation data is available, falling back to the cloud-cover heuristic when it is not.
- `features/derive-hour-features.ts` derives `diffuseToDirectRatio` (diffuse / (direct + 1)) and `hasFrost` (soil temp ≤ 0 °C) from raw radiation and soil temperature fields.
- `features/derive-hour-features.ts` guards `sweetSpotScore` against division-by-zero when `idealMin === hardMin` or `idealMax === hardMax`.
- `features/derive-hour-features.ts` derives `crepuscularScore` from three multiplicative Van Den Broeke sub-scores: geometry window (solar elevation −4° to 12°), occlusion + gap (broken/layered cloud with gaps), and beam visibility (AOD sweet-spot 0.10–0.30 with moderate humidity). The score is zero outside the geometry window. Previously this was an inline heuristic in `score-hour.ts`; it is now physics-informed and derived alongside other features.

## What not to edit casually

- the scoring math in [`score-all-days.ts`](./score-all-days.ts) without corresponding fixture or unit coverage
- the built-in session ranking order in [`sessions/index.ts`](./sessions/index.ts) without checking downstream presentation assumptions
- debug payload shape in [`../../lib/debug-context.ts`](../../lib/debug-context.ts), because email/debug tooling depends on it

## Tests

- [`score-all-days.test.ts`](./score-all-days.test.ts)
- [`features/derive-hour-features.test.ts`](./features/derive-hour-features.test.ts)
- [`sessions/index.test.ts`](./sessions/index.test.ts)
- [`nowcast/satellite-clearing.test.ts`](./nowcast/satellite-clearing.test.ts)
