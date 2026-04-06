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
  Built-in session evaluators, cross-hour selection, recommendation summary, and Plan B scenario generation.
- [`alerts/generate-alerts.ts`](./alerts/generate-alerts.ts)
  Safety and environmental alert generation from aggregated hour features (lightning, AQI, pollen, dust, UV).
- [`../../contracts/scored-forecast.ts`](../../contracts/scored-forecast.ts)
  Shared scored-forecast contract surface for callers.

## Working structure

- `features/`
  Hour-level feature engineering.
- `sessions/`
  Session evaluation, recommendation logic, and Plan B scenario framing (alternative-scenario string when primary confidence is medium or low).
- `alerts/`
  Safety and environmental alert generation. A pure function takes aggregated `DerivedHourFeatures` and produces `Alert[]` for lightning risk, AQI, pollen, dust (AOD), and UV exposure. Alerts are attached to `SessionRecommendationSummary` at the run level.
- `nowcast/`
  Near-term (0-6h) nowcast signal computation. Currently supports satellite radiation clearing/thickening detection via Open-Meteo Satellite Radiation API (EUMETSAT).
- `metar/`
  Structured METAR observation parsing. Extracts wx type (fog/mist/haze/smoke/rain/snow/thunderstorm), visibility, cloud base height, and dew-point spread from raw METAR strings using `metar-taf-parser`. Parsed fields are injected into `DerivedHourFeatures` for evaluator consumption.
- `marine/`
  Marine data parsing. Extracts per-timestamp wave height, direction, period, and peak period from the Open-Meteo Marine API response into a lookup table. Used by `score-all-days.ts` to backfill marine fields (`swellHeightM`, `swellPeriodS`, `swellDirectionDeg`, `waveHeightM`) into feature inputs for the seascape evaluator.
- `features/post-frontal-clarity.ts`
  Post-frontal clarity detection. Identifies the transient 2–6 hour window of clean, high-contrast air following frontal passage by combining four signals: recent rain accumulation, wind direction shift, visibility jump, and humidity drop. Produces a 0–100 `postFrontalClarityScore` per hour and a day-level peak/window summary. Requires multi-hour lookback so is computed in `summarize-day.ts` and backfilled into feature inputs.
- `score-all-days.ts`
  Orchestrates hourly scoring, day summaries, debug payload assembly, and session recommendation attachment.

## Defensive guards

- `summarize-day.ts` coalesces `null` AirQualityData into static fallbacks (AOD: 0.2, AQI: 25, Dust: 0, UV: 0) and issues console warnings so that downstream feature math survives the shorter Open-Meteo Air Quality forecast horizon.
- `summarize-day.ts` resolves `precipitation_probability` from the dedicated `PrecipProbData` input (fetched without a model pin so the API's best-match model provides real values). The main weather response does not carry this field.
- `summarize-day.ts` resolves `lightning_potential` from the same `PrecipProbData` input (also requires best-match model; not supported by UKMO `ukmo_seamless`). A **CAPE < 500 J/kg hard floor** is applied before the value is propagated as `lightningRisk`: in UK/Northern Europe mid-latitude conditions, lightning risk is effectively zero below this CAPE threshold, and gating prevents false-positive storm scores on calm photogenic days with incidental cloud.
- `summarize-day.ts` falls back to 20 for `total_column_integrated_water_vapour` and `null` for `boundary_layer_height` when absent. The UKMO model does not support these fields, so they are not requested in the Weather node URL. `boundary_layer_height` is available from ECMWF IFS HRES via the Open-Meteo ECMWF endpoint — see `workflow/build/README.md` for the future migration path. Mist scoring currently works via dew-point spread when boundary layer data is absent.
- `summarize-day.ts` extracts `direct_radiation`, `diffuse_radiation`, and `soil_temperature_0cm` from the weather response. These degrade to `null` when absent (e.g. if the model does not provide them), and derived features fall back gracefully.
- `summarize-day.ts` injects parsed METAR observation fields (`metarWxType`, `metarVisibilityM`, `metarCloudBaseM`, `metarDewPointSpreadC`, `visibilityDeltaVsModelKm`) into each hour's feature input. All fields are `null` when METAR is unavailable or unparseable.
- `summarize-day.ts` guards `crepRayPeak` against empty `hours` arrays (`Math.max(0, ...)` floor).
- `summarize-day.ts` extracts `pm2_5`, `alder_pollen`, `birch_pollen`, `grass_pollen` from the air quality response and forwards them to feature derivation as `pm25Ugm3`, `pollenGrainsM3` (max across species), `uvIndex`, and `europeanAqi` on `DerivedHourFeatures`. All degrade to `null` when not available.
- `sessions/evaluators/golden-hour.ts` applies a humidity haze penalty when RH exceeds 70% — hygroscopic aerosol swelling in humid air creates milky haze that mutes sunset colour vibrancy.
- `sessions/evaluators/golden-hour.ts` weights cloud-stratification (high-cloud translucency, low-cloud blocking) more heavily than total cloud percentage, reflecting research that cloud altitude distribution matters more than total cover for sunset colour.
- `sessions/evaluators/wildlife.ts` uses the physics-based `diffuseToDirectRatio` for soft-light scoring when radiation data is available, falling back to the cloud-cover heuristic when it is not.
- `sessions/evaluators/seascape.ts` requires marine swell data (`swellHeightM`, `swellPeriodS`) to hard-pass. When marine fields are null the evaluator returns score 0 with a diagnostic warning. Tide data is not yet required (deferred to a follow-up once a UK tide source is resolved).
- `features/derive-hour-features.ts` derives `diffuseToDirectRatio` (diffuse / (direct + 1)) and `hasFrost` (soil temp ≤ 0 °C) from raw radiation and soil temperature fields.
- `features/derive-hour-features.ts` guards `sweetSpotScore` against division-by-zero when `idealMin === hardMin` or `idealMax === hardMax`.
- `features/derive-hour-features.ts` derives `crepuscularScore` from three multiplicative Van Den Broeke sub-scores: geometry window (solar elevation −4° to 12°), occlusion + gap (broken/layered cloud with gaps), and beam visibility (AOD sweet-spot 0.10–0.30 with moderate humidity). The score is zero outside the geometry window. Previously this was an inline heuristic in `score-hour.ts`; it is now physics-informed and derived alongside other features.
- `summarize-day.ts` runs post-frontal clarity detection after scoring all hours (multi-hour lookback required). Backfills `postFrontalClarityScore` into feature inputs and emits `postFrontalClarityPeak` / `postFrontalClarityWindow` on `DaySummary`. Returns `null` when insufficient lookback data is available (< 3 hours).
- `score-all-days.ts` backfills marine data (`swellHeightM`, `swellPeriodS`, `swellDirectionDeg`, `waveHeightM`) from the parsed Marine API response into feature inputs. When no marine data is provided, all marine fields remain `null` and the seascape evaluator degrades gracefully (score 0 with a diagnostic warning).
- `score-all-days.ts` derives `recentRainfallMm` from a 6-hour trailing precipitation accumulation window using the existing weather data. This hydrology proxy is used by the waterfall evaluator without requiring a new API call.
- `sessions/evaluators/waterfall.ts` uses `recentRainfallMm` and humidity as flow proxies. Hard-pass requires recent rainfall > 2 mm OR humidity ≥ 90%, wind ≤ 25 kph, and visibility ≥ 2 km. Falls back to humidity-based scoring when rainfall data is unavailable.

## What not to edit casually

- the scoring math in [`score-all-days.ts`](./score-all-days.ts) without corresponding fixture or unit coverage
- the built-in session ranking order in [`sessions/index.ts`](./sessions/index.ts) without checking downstream presentation assumptions
- debug payload shape in [`../../lib/debug-context.ts`](../../lib/debug-context.ts), because email/debug tooling depends on it

## Tests

- [`score-all-days.test.ts`](./score-all-days.test.ts)
- [`features/derive-hour-features.test.ts`](./features/derive-hour-features.test.ts)
- [`sessions/index.test.ts`](./sessions/index.test.ts)
- [`alerts/generate-alerts.test.ts`](./alerts/generate-alerts.test.ts)
- [`nowcast/satellite-clearing.test.ts`](./nowcast/satellite-clearing.test.ts)
- [`metar/parse-metar.test.ts`](./metar/parse-metar.test.ts)
- [`features/post-frontal-clarity.test.ts`](./features/post-frontal-clarity.test.ts)
