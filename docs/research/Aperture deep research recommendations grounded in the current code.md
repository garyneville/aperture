# Aperture deep research recommendations grounded in the current code

## Ensemble cloud disagreement and a numeric forecast confidence signal

**What I found in the code (current behavior)**  
Aperture already computes an ensemble-spread signal from the Open‑Meteo ECMWF ensemble and uses it in a few important places, but not as a per-hour “confidence 0–1” value.

In `src/domain/scoring/score-all-days.ts`, `ensIdx` is built by scanning `ensemble.hourly.time` and collecting the per-member values for keys that start with `cloudcover_member`. For each timestamp, it computes the mean and standard deviation across members and stores `{ mean, stdDev }` by timestamp. fileciteturn80file0L1-L1

In `src/domain/scoring/daily/summarize-day.ts`, the scoring loop calls `scoreHour(...)` first (which builds `featureInput` with ensemble fields still set to `null`), then “backfills” `featureInput.ensembleCloudStdDevPct` and `featureInput.ensembleCloudMeanPct` from `ensIdx[ts]`. Those inputs are stored in `featureInputsByTs` for later use. fileciteturn81file0L1-L1 fileciteturn87file0L1-L1

Separately, daily confidence labels are computed from ensemble spread: `src/domain/scoring/daily/confidence.ts` averages stdDev over timestamps in AM golden hour, PM golden hour, night, and overall golden hour. It uses thresholds: High `< 12`, Medium `< 25`, Low `>= 25` (stdDev in “cloud cover points”). fileciteturn83file0L1-L1 fileciteturn81file0L1-L1

That day-level confidence and spread are surfaced in the prompt builder: `buildPrompt()` appends “Forecast models differ by about X cloud-cover points...” from `todayDay.confidenceStdDev`. fileciteturn70file0L1-L1

Ensemble spread also affects session scoring: `src/domain/scoring/sessions/shared.ts` exposes `spreadVolatility()` (rounded `ensembleCloudStdDevPct`) and uses it to set confidence buckets (high/medium/low) and apply uncertainty penalties (e.g., astro, golden, mist) that reduce session scores. fileciteturn64file0L1-L1 fileciteturn65file0L1-L1

What it does *not* currently do: it does not produce a numeric 0–1 confidence per hour, and `scoreHour()` does not use ensemble spread in the per-hour score formula (the ensemble fields are explicitly left `null` there). fileciteturn87file0L1-L1

**Recommended approach**  
Add a per-hour, numeric `forecastConfidence` (0–1) derived from ensemble spread, and use it primarily for *recommendation reliability* rather than altering the base “photogenic potential” score too aggressively.

Concretely:

- Compute `forecastConfidence` from `ensembleCloudStdDevPct` (already computed) using a small, monotonic mapping aligned to your existing daily thresholds.
- Attach it to every `ScoredHour` so offline dumps, debugging, and window selection can inspect it.
- Optionally aggregate it into a per-window confidence (median of window-hour confidence) and use it as a tie-breaker when two windows have similar peak scores, or to annotate/flag “high payoff but unreliable” windows.
- Keep the existing daily/session confidence labels, but make them derivable from the numeric value (so future UI/editorial can use either).

A practical mapping aligned to existing thresholds (`12` and `25` points) is:

- Treat stdDev ≈ `35` as “essentially no confidence” for cloud-dependent photography decisions.
- `confidence = clamp01(1 - stdDev / 35)`  
  - stdDev 0 → 1.00  
  - stdDev 12 → ~0.66 (roughly matches “high”)  
  - stdDev 25 → ~0.29 (roughly matches “low”)  
  - stdDev 35 → 0.00

This intentionally matches your current `confidence.ts` cutoffs while giving a continuous value. fileciteturn83file0L1-L1

**Where it should plug in**  
The cleanest insertion point is **after** the ensemble backfill in `summarize-day.ts`, because that’s where `ensembleCloudStdDevPct` is first known for the hour in your current structure. fileciteturn81file0L1-L1

If you later want `scoreHour()` itself to incorporate confidence, you’d need to pass ensemble spread into `scoreHour()` pre-derivation (i.e., compute `featureInput` with ensemble fields before calling `deriveHourFeatures` inside `scoreHour`). But I’d start with the separate field + window tie-breaker, because it avoids changing the meaning of existing scores.

**Implementation sketch (types, helper, integration)**  
Files and edits:

- Add a helper: `src/domain/scoring/hourly/ensemble-confidence.ts`
- Add a field to the hour type: `src/types/session-score.ts` (and any downstream types that mirror hour shape)
- Integrate in: `src/domain/scoring/daily/summarize-day.ts`

```ts
// src/domain/scoring/hourly/ensemble-confidence.ts
import { clamp } from '../../../lib/utils.js';

export function ensembleStdDevToForecastConfidence(stdDevPct: number | null, spreadAtZero = 35): number | null {
  if (stdDevPct == null) return null;
  const c = 1 - (stdDevPct / spreadAtZero);
  // clamp() in your utils appears to clamp 0..100; so implement tiny clamp01 here
  return Math.max(0, Math.min(1, c));
}
```

```ts
// src/types/session-score.ts (or wherever ScoredHour is defined/exported)
// Add field on ScoredHour-ish shape (where you already have ensembleCloudStdDevPct/MeanPct as optional)
export interface ScoredHour {
  // ...
  forecastConfidence?: number | null;
}
```

```ts
// src/domain/scoring/daily/summarize-day.ts
import { ensembleStdDevToForecastConfidence } from '../hourly/ensemble-confidence.js';

// inside the per-hour loop, AFTER you backfill ensemble into featureInput:
featureInput.ensembleCloudStdDevPct = ensIdx[ts] ? Math.round(ensIdx[ts]!.stdDev) : null;
featureInput.ensembleCloudMeanPct   = ensIdx[ts] ? Math.round(ensIdx[ts]!.mean)   : null;

const fc = ensembleStdDevToForecastConfidence(featureInput.ensembleCloudStdDevPct);
featureInput.forecastConfidence = fc;     // if you add it to DerivedHourFeatureInput
scoredHour.forecastConfidence = fc;       // if you add it to ScoredHour
```

If you also want window-level awareness without changing scoring:

- In `src/domain/windowing/best-windows/labeling.ts` (or wherever you finalize window objects), compute `window.forecastConfidence = median(hours.forecastConfidence)` and include it as a field that editorial/debug can see.

This leverages the ensemble spread you already compute (`ensIdx`) and the confidence thresholds you already use at the daily level. fileciteturn80file0L1-L1 fileciteturn81file0L1-L1 fileciteturn83file0L1-L1


## Azimuth horizon scan and offline snapshot parity

**What I found in the code (why offline dumps have `{}`)**  
Your azimuth system is genuinely multi-point in the real pipeline, and the offline snapshot/dump path deliberately discards it.

In the real workflow, the “prepare azimuth” step derives sample points from SunsetHue sun directions: `src/lib/prepare-azimuth.ts` reads `sunsetHueData` entries with `type` `sunrise|sunset` and uses a circular mean of their `direction` values, falling back to 90°/270° if missing. It then generates samples at `DISTANCES_KM = [25, 50, 80, 120, 160, 200]` km for each phase and produces an Open‑Meteo URL per point. fileciteturn86file0L1-L1

The n8n adapter `src/adapters/n8n/prepare-azimuth.adapter.ts` calls `prepareAzimuthSamples(...)` and outputs those samples to drive the downstream fetches. fileciteturn28file0L1-L1 fileciteturn86file0L1-L1

After n8n fetches weather for each sample point, `src/adapters/n8n/aggregate-azimuth.adapter.ts` calls `aggregateAzimuth(scanResults, sampleMeta)` to merge those per-point forecasts into a single structure with `byPhase.sunrise[ts]` and `byPhase.sunset[ts]` scan results, including `occlusionRisk` and `horizonGapPct`. fileciteturn34file0L1-L1

`src/adapters/n8n/wrap-azimuth.adapter.ts` then wraps the merged output into `azimuthByPhase` for scoring. fileciteturn32file0L1-L1

Scoring consumes it in `summarize-day.ts`: for golden/blue hours it picks `azimuthByPhase[phase][ts]` and uses `occlusionRisk` and `horizonGapPct` (plus `clearPathBonus`) to adjust drama/clarity and store `azimuthRisk/horizonGapPct` on the hour. fileciteturn81file0L1-L1 fileciteturn87file0L1-L1

By contrast, the snapshot script captures only a single “25km west” Open‑Meteo call (hard-coded bearing 270° and distance 25 km). fileciteturn78file0L1-L1

And `scripts/dump-pipeline.ts` explicitly sets `azimuthByPhase = {}` with a comment that reconstruction is impossible from a single point. fileciteturn79file0L1-L1

**Also important: there’s a distance/meta mismatch right now**  
`prepare-azimuth.ts` uses distances `[25, 50, 80, 120, 160, 200]`. fileciteturn86file0L1-L1  
But `aggregate-azimuth.adapter.ts` hard-codes a different `sampleMeta` distance set (and fixed bearings 90/270). That means even in the real pipeline, the weighting/meta used in aggregation may not match the samples you generated, which can skew occlusion risk. fileciteturn34file0L1-L1

**Recommended approach**  
Do two things—one minimal for offline debugging, one correctness fix for the real pipeline.

- **Minimal offline parity (fastest):** In `dump-pipeline.ts`, if you only have one azimuth payload, synthetically “fan it out” into N identical sample results and run `aggregateAzimuth` so `azimuthByPhase` is non-empty in offline dumps. This lets you debug scoring/plumbing (azimuthRisk affecting `drama`, `clarity`, tags, etc.) without changing the snapshot script.
- **Correctness/parity fix (real pipeline + snapshot):** Make aggregation consume the *actual sample meta* produced by `prepareAzimuthSamples()` (bearings + exact distance list). This also tells you what coordinates/how many points to snapshot.

**Should snapshot capture multiple points?**  
Yes, if you want offline dumps to reproduce real azimuth behavior. Based on `prepare-azimuth.ts`, you need:

- **Two phases**: sunrise + sunset
- **Six distances per phase**: 25, 50, 80, 120, 160, 200 km
- Total: **12 sample points**, along bearings derived from SunsetHue directions (fallback 90° and 270°). fileciteturn86file0L1-L1

**Is synthetic reconstruction “good enough”?**  
It’s good enough for debugging:

- whether `azimuthByPhase` is being threaded into scoring,
- whether `p.azimuthRisk` penalties/bonuses are applied,
- whether horizon tags like “clear light path” appear. fileciteturn87file0L1-L1

It is **not** good enough for debugging distance-based occlusion behavior (because every sample is identical, so “near horizon clear but far horizon blocked” patterns can’t appear).

**Minimum changes to make azimuth appear in offline dumps**  
You can do this with **one file change** (dump only) or minimal updates to both.

### Minimal change option A: only modify `dump-pipeline.ts`
Add imports and reconstruct `azimuthByPhase` using `aggregateAzimuth`:

```ts
// scripts/dump-pipeline.ts
import { prepareAzimuthSamples } from '../src/lib/prepare-azimuth.js';
import { aggregateAzimuth } from '../src/lib/aggregate-azimuth.js';

// ... after you load `sunsetHue` and `raw.azimuth`:
const azimuthSample = raw.azimuth ?? null;

let azimuthByPhase = {};
if (azimuthSample && typeof azimuthSample === 'object') {
  const samples = prepareAzimuthSamples({
    lat: DEFAULT_HOME_LOCATION.lat,
    lon: DEFAULT_HOME_LOCATION.lon,
    timezone: DEFAULT_HOME_LOCATION.timezone,
    sunsetHueData: sunsetHue as any[],
  });

  const sampleMeta = samples.map(s => ({
    type: s.type,                // 'sunrise' | 'sunset'
    bearing: s.bearing,
    distanceKm: s.distanceKm,
  }));

  // Synthetic: duplicate the single azimuth payload to match the sample count.
  const scanResults = samples.map(() => azimuthSample);

  azimuthByPhase = aggregateAzimuth({ scanResults, sampleMeta }).byPhase ?? {};
}
```

Now `normalizedInputs.azimuthByPhase` will no longer be `{}` in stage 1 dumps, and hours in stage 2 will populate `horizonGapPct`/`azimuthRisk` where applicable. fileciteturn79file0L1-L1 fileciteturn81file0L1-L1

### Minimal change option B: capture real samples in `snapshot-apis.sh` + aggregate in `dump-pipeline.ts`
- Modify `snapshot-apis.sh` to:
  - call SunsetHue first,
  - compute bearings,
  - loop the 12 URLs produced by the same distance list and destination formula,
  - save each as `08a/08b/...` files.
- Modify `dump-pipeline.ts` to load those 12 files into `scanResults` and aggregate.

Because `snapshot-apis.sh` already uses Python for the single 25km west computation, you can reuse the same great-circle math, but you should switch the distance list to `[25,50,80,120,160,200]` and the bearing to `sunrise`/`sunset` bearings. fileciteturn78file0L1-L1 fileciteturn86file0L1-L1

**Correctness fix: unify sampleMeta between prepare and aggregate**  
Right now `aggregate-azimuth.adapter.ts` isn’t guaranteed to match what `prepareAzimuthSamples()` emitted. The simplest fix:

- Make `aggregate-azimuth.adapter.ts` accept the sample list (or sampleMeta) from the upstream “prepare” node rather than hard-coding distances/bearings, or
- Import the shared `DISTANCES_KM` and the computed bearings.

This eliminates “pipeline works but weights wrong” failures. fileciteturn34file0L1-L1 fileciteturn86file0L1-L1


## SunsetHue quality mapping and why `shQ` can appear null

**What I found in the code (expected mapping)**  
`shQ` is intentionally **not** a value for “every hour.” It is a twilight-quality scalar only applied to golden-hour hours.

Mechanically:

- `computeTwilightBoundaries()` looks up SunsetHue entries by keys `${dateKey}_sunrise` and `${dateKey}_sunset` and extracts `quality` (0–1) as `shSunriseQ` and `shSunsetQ`. fileciteturn82file0L1-L1
- In `summarize-day.ts`, each hourly record computes `isGoldAm` / `isGoldPm` from those twilight boundaries, then sets:  
  `shQ = isGoldAm ? shSunriseQ : isGoldPm ? shSunsetQ : null` fileciteturn81file0L1-L1
- `scoreHour()` then turns `shQ` into a drama boost: `shBoost = shQ * 25` points (rounded) that is added into drama and therefore into the final score. fileciteturn87file0L1-L1

In your committed offline dump example (`debug/pipeline-dump-2026-04-05T140417/03-editorial-context.json`), `20:00` is golden hour (`isGoldPm: true`) and has `shQ: 0.28`, which confirms the mapping works end-to-end at least in that snapshot. fileciteturn73file0L1-L1

**Why you might be seeing `shQ: null` everywhere**  
Given the implementation, “always null” narrows to just a few failure modes:

- You are inspecting hours outside the golden-hour boundaries (by design, `shQ` is null then). fileciteturn81file0L1-L1
- SunsetHue data is being dropped before it reaches `scoreAllDays()`:
  - `score-all-days.ts` builds `shByDay` only if `input.sunsetHue` is an array; non-array values are silently treated as empty. fileciteturn80file0L1-L1
  - In the n8n layer, the intended adapter `wrap-sunset-hue.adapter.ts` converts a raw response into an array (either `raw.data` or `raw`). If this adapter is bypassed or a merge node nests it differently, `score-all-days` will see the wrong shape. fileciteturn21file0L1-L1 fileciteturn80file0L1-L1
- SunsetHue entries have unexpected `type` values (not exactly `sunrise`/`sunset`), so keys like `${date}_Sunset` won’t match `${date}_sunset`. Keying is stringly-typed (`e.type` is used directly). fileciteturn80file0L1-L1 fileciteturn82file0L1-L1

**Recommended approach**  
Treat this as primarily a **plumbing + observability** problem, not a missing feature—because the mapping exists and affects scoring.

Recommendations:

- Add explicit validation when SunsetHue arrives:
  - If `sunsetHue.length > 0` but none of the entries match `type === 'sunrise'|'sunset'`, log a warning with a small sample of received types.
- Add a debug field to day summary:
  - `sunsetHueUsed: boolean`
  - `sunsetHueMissingReason: 'no-data'|'bad-shape'|'bad-type'|...`
- Decide whether you *want* `shQ` for blue hours. Right now, blue hour does *not* inherit SunsetHue quality, even though “quality” can plausibly reflect twilight color risk across both golden and blue.

If you do want a richer mapping:
- Keep `shQ` as-is (golden only), and add a separate `shQBlue` for blue-hour hours, or
- Apply `shQ` to both golden and blue hours but weight it down for blue hours (e.g., multiply by 0.5), since blue hour color and contrast differ from golden. That preserves backward compatibility while making the field “less often null” in UI/debug.

**Implementation sketch**  

1) Add validation in `score-all-days.ts` SunsetHue ingestion:

```ts
// src/domain/scoring/score-all-days.ts
const shArr = Array.isArray(input.sunsetHue) ? input.sunsetHue : [];
const types = new Set(shArr.map(e => e.type).filter(Boolean));
if (shArr.length && (!types.has('sunrise') || !types.has('sunset'))) {
  console.warn('[SunsetHue] unexpected or missing types:', Array.from(types).slice(0, 5));
}
```

2) Optionally map SunsetHue quality onto blue hours in `summarize-day.ts`:

```ts
// src/domain/scoring/daily/summarize-day.ts
const shQ =
  isGoldAm ? shSunriseQ :
  isGoldPm ? shSunsetQ :
  isBlueAm ? (shSunriseQ != null ? shSunriseQ * 0.5 : null) :
  isBluePm ? (shSunsetQ != null ? shSunsetQ * 0.5 : null) :
  null;
```

This is a product decision: it will change scores because `scoreHour()` uses `shQ` to boost drama. If you don’t want score shifts, add a distinct field and keep `shQ` golden-only. fileciteturn87file0L1-L1 fileciteturn81file0L1-L1


## Window threshold tuning and understanding why fallback can “not fire”

**What I found in the code (windowing control flow)**  
Window selection is primarily `bestWindows()` → `groupWindows()` with a default threshold.

- `groupWindows(hours, threshold = 45)` groups consecutive hours with `score >= threshold` into windows. It does not require multiple hours; a single qualifying hour still yields a window. It then **sorts by peak score and truncates to 3 windows**. fileciteturn54file0L1-L1
- `bestWindows()`:
  - builds those windows,
  - expands single-hour golden/blue windows to include an adjacent hour in the same session,
  - and only if *no windows exist* does it try fallbacks. fileciteturn56file0L1-L1 fileciteturn62file0L1-L1
- `buildFallbackWindow()` only considers golden/blue hours and requires `best.score >= 36`. fileciteturn60file0L1-L1
- `buildSessionFallbackWindow()` exists, but only takes effect if the best session score is “strong” (>= 58) and windows were empty. fileciteturn60file0L1-L1

In your committed example context, **23:00 has score 51** (astro) and **20:00 has score 43** (golden). A threshold of 45 would produce a window at 23:00, meaning the golden-hour fallback would never run. fileciteturn73file0L1-L1 fileciteturn56file0L1-L1 fileciteturn60file0L1-L1

That is the most plausible “why didn’t fallback trigger?” explanation **even if** your best golden hour was decent: a single high-scoring astro hour prevents fallback by design.

**Recommended approach**  
Tune for two outcomes simultaneously:

- Avoid “no windows” on mediocre days.
- Avoid merging huge bland windows on good days, especially given the algorithm groups purely by consecutive hours.

I recommend three changes:

- Make the threshold **adaptive** instead of a fixed 45:
  - Try 45 first.
  - If `windows.length === 0`, retry at 42.
  - If still none, retry at 40.
  - If still none, fall back.
- Add an explicit “best single hour” emergency fallback when both threshold windows and golden/blue fallback fail.
- Increase max windows beyond 3 if you truly want “3–6” on good days—your current code hard-caps at 3. fileciteturn54file0L1-L1

**Would lowering threshold 45 → 40 cause problems?**  
It likely causes more *merging* than more *count*, because windows are consecutive-hour groups. On “good” days, many daytime hours may float around 40–55; threshold 40 creates broad windows that smear distinct light situations (e.g., interesting golden hour vs flat midday). You already cap windows to 3, so you won’t get “too many,” you’ll get “too wide.” fileciteturn54file0L1-L1

The adaptive approach avoids that: mediocre days get rescued by a lower threshold, but strong days keep the higher bar.

**Implementation sketch**  

1) Make threshold adaptive in `bestWindows()`:

```ts
// src/domain/windowing/best-windows.ts
import { groupWindows } from './best-windows/grouping.js';

const THRESHOLDS = [45, 42, 40];

let windows: WindowCandidate[] = [];
for (const thr of THRESHOLDS) {
  windows = groupWindows(todayHours, thr);
  if (windows.length) break;
}
```

2) Add best-single-hour fallback to `fallback.ts`:

```ts
// src/domain/windowing/best-windows/fallback.ts
export function buildBestHourFallback(hours: ScoredHour[], minScore = 30): WindowCandidate | null {
  const best = hours.reduce((b, h) => (h.score > b.score ? h : b), hours[0]);
  if (!best || best.score < minScore) return null;
  return {
    start: best.hour,
    end: best.hour,
    st: best.t,
    et: best.t,
    peak: best.score,
    tops: (best.tags || []).slice(0, 2),
    hours: [best],
  };
}
```

Then in `bestWindows()` after existing fallbacks:

```ts
const bestHourFallback = buildBestHourFallback(todayHours);
if (bestHourFallback) windows = [bestHourFallback];
```

3) If you want more than 3 windows on great days, change `groupWindows()` to accept `maxWindows` and set it to 6, or make it a config constant. fileciteturn54file0L1-L1 fileciteturn56file0L1-L1 fileciteturn60file0L1-L1


## Kp forecast trimming and a lightweight geomagnetic trend summary

**What I found in the code (what uses Kp, and where bloat can happen)**  
The n8n adapter `wrap-kp-index.adapter.ts` parses the NOAA SWPC Kp forecast into `kpForecast: {time, kp}[]` and **does not trim** historical rows. It also drops “observed/forecast” flags entirely, keeping only time and kp. fileciteturn68file0L1-L1

In the editorial pipeline, the scored context includes `kpForecast` (the debug dump’s editorial context shows it included as an array). fileciteturn73file0L1-L1

But the prompt builder only uses Kp to compute a single scalar: `peakKpTonight`, scanning entries between 18:00 and 06:00, and then writes an aurora note (or not). Historical entries are not referenced by that function. fileciteturn69file0L1-L1 fileciteturn70file0L1-L1

So: today, historical Kp values appear to be payload/debug bloat more than a scoring signal.

Also, the offline dump script’s Kp parsing is currently inconsistent with the adapter: `dump-pipeline.ts` has `parseKpRows()` that expects object rows with `time_tag`, which does not match the SWPC array-of-arrays format mentioned in the adapter comment. That means offline dumps may silently get empty Kp unless your snapshot extraction matches that object-shape. fileciteturn79file0L1-L1 fileciteturn68file0L1-L1

**Recommended approach**  
Do both:

- **Trim `kpForecast` before it reaches editorial context** (and offline dumps) to keep payloads small and predictable.
- Add a **tiny trend summary** that is cheaper than shipping 10 days of 3‑hour entries, and can be used editorially (and eventually to modulate aurora confidence).

A minimal trim policy:

- Keep entries from `now - 24h` through `now + 72h` (or through the end of tomorrow night).
- Compute and pass `kpTrend`:
  - `recentPeakKp` (max over last 72h)
  - `hoursSincePeak`
  - `trend` (rising / falling / flat over last 24h)

This gives the “Kp has been declining since…” narrative without shipping the full series.

**Implementation sketch**  

1) Add utilities (shared by adapter + dump script): `src/lib/kp-trend.ts`

```ts
export type KpEntry = { time: string; kp: number };

export function trimKpForecast(entries: KpEntry[], now: Date, pastHours = 24, futureHours = 72): KpEntry[] {
  const start = new Date(now.getTime() - pastHours * 3600_000);
  const end   = new Date(now.getTime() + futureHours * 3600_000);
  return entries.filter(e => {
    const t = new Date(e.time);
    return t >= start && t <= end && Number.isFinite(e.kp);
  });
}

export function summarizeKpTrend(entries: KpEntry[], now: Date) {
  const recent = trimKpForecast(entries, now, 72, 0); // last 72h only
  if (!recent.length) return { recentPeakKp: null, hoursSincePeak: null, trend: 'unknown' as const };

  let peak = recent[0]!;
  for (const e of recent) if (e.kp > peak.kp) peak = e;
  const hoursSincePeak = Math.round((now.getTime() - new Date(peak.time).getTime()) / 3600_000);

  const last24 = trimKpForecast(entries, now, 24, 0);
  const slope = last24.length >= 2
    ? (last24[last24.length - 1]!.kp - last24[0]!.kp)
    : 0;

  const trend = slope > 0.5 ? 'rising' : slope < -0.5 ? 'declining' : 'flat';
  return { recentPeakKp: peak.kp, hoursSincePeak, trend };
}
```

2) Apply trimming in `build-prompt.adapter.ts` (cheap win because it is the choke point into the editorial prompt builder):

```ts
// src/adapters/n8n/build-prompt.adapter.ts
import { trimKpForecast, summarizeKpTrend } from '../../lib/kp-trend.js';

const now = new Date();
const kpForecastTrimmed = Array.isArray(input.kpForecast) ? trimKpForecast(input.kpForecast, now) : [];
const kpTrend = summarizeKpTrend(kpForecastTrimmed, now);

const result = buildPrompt({
  // ...
  kpForecast: kpForecastTrimmed,
  // optionally: kpTrend if you add it to BuildPromptInput
});
```

3) Fix offline parity: update `dump-pipeline.ts` to parse SWPC array-of-arrays the same way `wrap-kp-index.adapter.ts` does, or directly import and call the adapter’s logic. fileciteturn79file0L1-L1 fileciteturn68file0L1-L1


## Editorial retry, OpenRouter status, and surfacing diagnostics

**What I found in the code (current editorial flow boundaries)**  
The editorial *resolution* logic is in TypeScript, but the actual provider calls appear to be outside this codebase (likely n8n HTTP nodes), because the TS layer accepts provider responses already-materialized.

- `resolve-editorial.ts` builds the final `aiText` by comparing/parsing Groq and Gemini responses and falling back to template text if necessary. It does not call providers or retry. fileciteturn39file0L1-L1
- `src/lib/retry.ts` provides an exponential backoff helper, but nothing in the resolution path imports it. fileciteturn45file0L1-L1
- Runtime config defines `'openrouter'` as an allowed provider name, but it’s not listed among defaults and does not appear to be invoked by any TS-facing gateway. fileciteturn37file0L1-L1
- `docs/openrouter-migration.md` suggests migration work, but the wiring is not complete in the current workflow build list. (`assemble.ts` lists Groq/Gemini-related adapters, no OpenRouter node.) fileciteturn50file0L1-L1 fileciteturn77file0L1-L1
- When both providers fail or parsing fails, fallback text is generated by `buildFallbackAiText()` (generic, but time/window-aware if possible) without necessarily surfacing provider diagnostics in the user-facing text. fileciteturn41file0L1-L1 fileciteturn40file0L1-L1

**Recommended approach**  
Separate concerns cleanly:

- Keep `resolveEditorial()` pure and synchronous-ish: it should decide among already-present candidate outputs and produce a result + diagnostics.
- Put retries where the provider calls are executed:
  - If provider calls are n8n HTTP nodes: use n8n’s retry-on-fail settings (preferred operationally).
  - If you want code-level retries: create a dedicated adapter node that performs the HTTP call from inside the code node and uses `retryWithBackoff()`.
- Decide OpenRouter’s fate:
  - If you want it: implement it properly as a third provider in the workflow (Groq → Gemini → OpenRouter → template, or Groq → OpenRouter → template).
  - If you don’t: remove it from the runtime provider type and config surface to reduce “dead option” confusion.

Diagnostics should be surfaced in *debug outputs* at minimum:

- Always include a concise provider failure summary in debugContext / debug email when fallback text is used.
- Optionally include a small “(AI fallback used)” flag in the rendered brief metadata.

**Implementation sketch**  

### Integrate retry into the editorial path (code-level option)
Create a new adapter `src/adapters/n8n/call-provider.adapter.ts` that:

- Reads `{ prompt, providerName }`
- Calls the provider with `retryWithBackoff()` on 429/5xx/timeouts
- Returns `{ ok, rawText, status, attempts, error }`

Pseudocode:

```ts
// src/adapters/n8n/call-provider.adapter.ts
import { retryWithBackoff } from '../../lib/retry.js';

export async function run({ $input }: N8nRuntime) {
  const { providerName, request } = $input.first().json as any;

  const result = await retryWithBackoff({
    maxAttempts: 3,
    baseDelayMs: 500,
    backoffMultiplier: 2,
    jitterMs: 200,
    task: async () => {
      const res = await fetch(/* provider endpoint */, { /* auth */ });
      if (res.status === 429 || res.status >= 500) throw new Error(`retryable:${res.status}`);
      const txt = await res.text();
      return { status: res.status, rawText: txt };
    },
    shouldRetry: err => String(err).includes('retryable:'),
  });

  return [{ json: { providerName, ...result } }];
}
```

This makes `retry.ts` “real” and reusable. fileciteturn45file0L1-L1

### OpenRouter status decision
- If you keep it: add an adapter and a workflow placeholder, then include it in `ADAPTERS` in `workflow/build/assemble.ts`. fileciteturn77file0L1-L1  
- If you remove it: delete `'openrouter'` from `EditorialProviderName` and from provider parsing logic in runtime config. fileciteturn37file0L1-L1

### Surface diagnostics when falling back
In `resolve-editorial.ts`, when you choose fallback text, attach a machine-readable `fallbackReason` and include `providerDiagnostics` in the returned payload (even if not shown to end users). That avoids silent “everything is fine” behavior. fileciteturn39file0L1-L1 fileciteturn41file0L1-L1


## Unit tests for `score-hour.ts` and NaN safety

**What I found in the code (test gap and NaN risk)**  
`scoreHour()` is a pure function that maps `ScoreHourParams` to `{ hour, featureInput }` with a deterministic scoring and tagging system. It includes multiple phase-conditioned score formulas and several optional/null inputs (e.g., direct/diffuse radiation, BLH, azimuth fields). fileciteturn87file0L1-L1

You already have substantial tests for `deriveHourFeatures()` in `derive-hour-features.test.ts`. fileciteturn75file0L1-L1  
But there are no dedicated tests for `score-hour.ts` in the current repository (and the function carries a lot of implicit product logic: phase weights, tag thresholds, shQ boosting, azimuth penalties). fileciteturn87file0L1-L1

On NaN risk: in `scoreHour()`, nearly all calculations are guarded by defaults or null checks, then clamped. The obvious NaN vectors (null arithmetic, undefined comparisons) appear handled, but a regression could slip in easily because of the number of branches and implicit numeric conversions. fileciteturn87file0L1-L1

**Recommended approach**  
Add a minimal, high-signal test suite for `score-hour.ts` that covers:

- **Night astro path** (`isNight=true`, deep solar altitude): ensures astro scoring dominates and tags include `astrophotography`.
- **AM golden/blue path** weighting (drama 0.30, clarity 0.40, mist 0.30).
- **PM golden/blue path** weighting (drama 0.55, clarity 0.30, mist 0.15).
- **Generic daytime path** (sorted [drama, clarity, mist] weighting).
- **Overcast vs broken cloud** tag logic and score shifts.
- **SunsetHue boost**: `shQ` non-null increases drama and overall score at golden hour.
- **Null-safety**: all optional nullable fields set to `null` simultaneously → score remains finite.

Keep assertions *behavioral* (relative comparisons, tag presence) rather than brittle point-exact values, because you’ll iterate on the scoring.

**Implementation sketch**  
Create `src/domain/scoring/hourly/score-hour.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreHour, type ScoreHourParams } from './score-hour.js';

function make(overrides: Partial<ScoreHourParams> = {}): ScoreHourParams {
  return {
    ts: '2026-04-06T20:00:00.000Z',
    i: 0,
    lat: 53.8,
    lon: -1.57,
    timezone: 'Europe/London',
    cl: 10, cm: 20, ch: 30, ct: 45,
    visK: 20, tmp: 10, hum: 60, dew: 5,
    pp: 10, pr: 0, spd: 5, gst: 10, wdir: 270,
    cap: 0, vpd: 0.5, prev: 0, tpw: 20,
    blh: null, drad: null, frad: null, st0: null,
    aod: 0.12, dust: 0, aqi: 25, uv: 0,
    isGolden: true, isGoldAm: false, isGoldPm: true,
    isBlue: false, isBlueAm: false, isBluePm: false,
    isNight: false,
    isPostSunset: true,
    azimuthRisk: null, azimuthLowRisk: null, azimuthScan: null, horizonGapPct: null,
    lightningRisk: null,
    shQ: null,
    pm25: null,
    pollenMax: null,
    ...overrides,
  };
}

describe('scoreHour', () => {
  it('adds a measurable boost when shQ is present during golden hour', () => {
    const a = scoreHour(make({ shQ: null })).hour.score;
    const b = scoreHour(make({ shQ: 0.8 })).hour.score;
    expect(b).toBeGreaterThan(a);
  });

  it('produces an astro-tagged hour at night with low cloud', () => {
    const { hour } = scoreHour(make({
      isNight: true,
      isGolden: false, isGoldPm: false,
      ts: '2026-04-06T23:00:00.000Z',
      ct: 5,
      visK: 30,
      aqi: 10,
      uv: 0,
    }));
    expect(hour.tags).toContain('astrophotography');
    expect(Number.isFinite(hour.score)).toBe(true);
  });

  it('does not produce NaN when all optional nullable fields are null', () => {
    const { hour } = scoreHour(make({
      blh: null, drad: null, frad: null, st0: null,
      azimuthRisk: null, azimuthLowRisk: null, horizonGapPct: null,
      lightningRisk: null, shQ: null, pm25: null, pollenMax: null,
    }));
    expect(Number.isFinite(hour.score)).toBe(true);
  });
});
```

This targets the hot path where regressions would be expensive. fileciteturn87file0L1-L1


## Runtime config validation and workflow build robustness

**What I found in the code (silent failure modes and build fragility)**  
Two reliability issues stand out.

### Silent config fallback
`src/config/runtime.ts` reads environment-based configuration, but:

- Editorial providers are parsed from a comma-separated string and **unknown values are silently filtered out**, potentially leaving you with defaults without noticing (“groqq” → ignored). fileciteturn37file0L1-L1
- Home location fields (lat/lon/timezone/name) have defaults (Leeds), so failure to inject values in n8n can silently shift the user’s location. fileciteturn37file0L1-L1

### Adapter bundling staleness / discovery risk
`workflow/build/assemble.ts` hardcodes an `ADAPTERS` map (~30 entries). If you add a new `*.adapter.ts` file but don’t add it to this map **and** don’t add a placeholder in the skeleton, the workflow won’t include it. There is also no “workflow is up-to-date” check; you can modify adapter logic and forget to rebuild `generated/workflow/photography-weather-brief.json`. fileciteturn77file0L1-L1

Also, your offline dump intentionally omits very large payload snapshots for size, which shows you already care about output bloat. fileciteturn79file0L1-L1

**Recommended approach**  
Keep it minimal and practical:

- Add a lightweight validation layer that runs at the start of the workflow (or at least in `debug-config.adapter.ts`) and fails fast in “strict mode.”
- Make adapter discovery automatic (or at least validate completeness) and add `npm run build:validate` to fail CI when generated workflow is stale.
- Balance payload size by passing **summaries, not raw series** into editorial prompts, while keeping full raw payloads in debug snapshots only when a debug flag is enabled.

**Implementation sketch**  

### Minimal runtime validation (no new dependencies)
Add `src/config/validate-runtime.ts`:

```ts
import { getPhotoWeatherLat, getPhotoWeatherLon, getPhotoWeatherTimezone, getPhotoBriefEditorialProviders } from './runtime.js';

export function validateRuntimeConfig({ strict }: { strict: boolean }) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lat = getPhotoWeatherLat();
  const lon = getPhotoWeatherLon();
  if (lat < -90 || lat > 90) errors.push(`Invalid lat: ${lat}`);
  if (lon < -180 || lon > 180) errors.push(`Invalid lon: ${lon}`);

  const tz = getPhotoWeatherTimezone();
  if (!tz || typeof tz !== 'string') errors.push('Missing timezone');

  const providers = getPhotoBriefEditorialProviders();
  if (!providers.length) errors.push('No editorial providers configured');

  if (warnings.length) console.warn('[config] warnings:', warnings);
  if (errors.length) {
    const msg = `[config] errors:\n- ${errors.join('\n- ')}`;
    if (strict) throw new Error(msg);
    console.warn(msg);
  }
}
```

Call it from a “first” node (e.g., `debug-config.adapter.ts`) and enable strict mode with an env var.

Also: modify provider parsing in `runtime.ts` to log unknown provider names instead of silently filtering. fileciteturn37file0L1-L1

### Adapter auto-discovery + build validation
1) Auto-discover adapter files by directory scan:

- Scan `src/adapters/n8n` for `*.adapter.ts`.
- Derive adapter name from filename (e.g., `wrap-weather.adapter.ts` → `wrap-weather`).
- Use that to fill placeholders `__ADAPTER_<name>__`.

2) Add `build:validate`:

- Run assembly in-memory and compare to the committed/generated workflow file.
- Fail if different.

Pseudo-structure:

```ts
// workflow/build/validate.ts
import { assembleWorkflow, OUTPUT_PATH } from './assemble.js';
import { readFileSync } from 'fs';

const fresh = await assembleWorkflow();
const existing = readFileSync(OUTPUT_PATH, 'utf-8');
if (fresh !== existing) {
  console.error('Generated workflow is stale. Run npm run build:workflow');
  process.exit(1);
}
```

This is the best “right balance” for payload and correctness: keep useful context in strongly-typed summarized objects (dailySummary/windows/sessionRecommendation) while preventing silent pipeline skew from stale workflow generation. fileciteturn77file0L1-L1 fileciteturn79file0L1-L1