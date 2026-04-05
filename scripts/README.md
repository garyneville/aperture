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

## snapshot-apis.sh

Captures live API responses into a timestamped `debug/api-snapshot-*` directory for offline replay by `dump-pipeline.ts`. The snapshot covers 11 endpoints (items 01–11). A redundant 1-day long-range call for the representative alt-location was removed in #251 — the 5-day alt-weather response is a strict superset.

## esm-compat-loader.mjs

Custom Node.js loader for ESM/TypeScript compatibility when running scripts directly.
