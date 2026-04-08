# Scripts

Local development and debugging scripts for the Aperture pipeline.

## dump-pipeline.ts

Replays an API snapshot through the scoring pipeline and writes each stage's output to `debug/pipeline-dump-<timestamp>/`.

**Usage:**

```bash
npm run cli:dump-pipeline            # uses most recent snapshot
npx ts-node scripts/dump-pipeline.ts debug/api-snapshot-<timestamp>  # specific snapshot
```

**Stages dumped:**

| File | Stage | Description |
|------|-------|-------------|
| `01-normalized-inputs.json` | 1 | Adapter-normalized payloads (what scoring sees) |
| `02-scoring-output.json` | 2 | `scoreAllDays()` result (hours, daily summary, sessions) |
| `02b-alt-scoring-output.json` | 2b | `scoreAlternatives()` result (alt locations, close contenders) |
| `03-editorial-context.json` | 3 | Scored context that feeds the editorial prompt builder |

Alt-location scoring (Stage 2b) discovers `alt-weather-*` snapshot files dynamically and matches them to the location registry in `src/lib/prepare-alt-locations.ts`.

### ⚠ Dump scores may differ from live runs

Pipeline dump scores can diverge from production email scores by 10–15 points. Two known causes:

1. **Missing azimuth/SunsetHue data.** The dump passes `azimuthByPhase = {}` because the snapshot contains only one sample point, not the full multi-point scan. In the live pipeline, the SunsetHue quality factor (`shQ * 25`) adds up to +25 drama points, which propagates ~+7–14 to the PM composite score.

2. **"Today" date drift.** The dump uses the current wall-clock time to determine which date is "today". If the dump runs on a different day (or even a few hours later) than the snapshot was captured, a different date becomes Day 0, changing the headline scores shown for "today".

These are inherent limitations of offline replay — the dump is best used for structural verification (are features non-null? do sessions fire?) rather than exact score matching against a specific email run.

### Data sources loaded from snapshot

| Snapshot file pattern | Field | Notes |
|-----------------------|-------|-------|
| `weather-ukmo` | `weather` | Merged with ECMWF supplement fields when present |
| `ecmwf` | ECMWF supplement | Merges `boundary_layer_height` + `soil_temperature_0cm` into weather |
| `satellite-radiation` | `nowcastSatellite` | Nowcast clearing signal for near-term hours (0–6h) |
| `marine` | `marine` | Wave data; irrelevant for inland locations |
| `air-quality` | `airQuality` | |
| `metar` | `metarRaw` | |
| `sunsethue` | `sunsetHue` | |
| `precip-prob` | `precipProb` | |
| `ensemble` | `ensemble` | |
| `kp-index` | `kpForecast` | |
| `aurorawatch` | aurora near-term | |
| `nasa-donki` | aurora long-range | |

Missing snapshot files produce a `⚠` warning but are handled gracefully (the field is omitted / treated as empty).

## snapshot-apis.sh

Captures live API responses into a timestamped `debug/api-snapshot-*` directory for offline replay by `dump-pipeline.ts`. The snapshot covers 14 endpoints (items 01–14). A redundant 1-day long-range call for the representative alt-location was removed in #251 — the 5-day alt-weather response is a strict superset.

## esm-compat-loader.mjs

Custom Node.js loader for ESM/TypeScript compatibility when running scripts directly.
