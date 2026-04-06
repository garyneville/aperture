# Aperture — Fix & Improve Plan

Findings from pipeline analysis on 6 Apr 2026. Phases 1–4 merged (PRs #269, #271, #273, #275). Below: remaining issues found during post-merge verification run (21:32 snapshot).

---

## Closed phases (for reference)

| Phase | Items | Status |
|-------|-------|--------|
| **1** | Gemini token budget, Groq model, AuroraWatch 404 | ✅ Merged (#269) |
| **2** | Radiation fields, soil temp, BLH docs | ✅ Merged (#271) |
| **3** | Score gap, debug clarity, confidence, long-range gating | ✅ Merged (#273) |
| **4** | Fallback bullets, comfort labels, marine skip, inspire docs | ✅ Merged (#275) |
| **R1** | Comfort labels wired into ScoredHour | ✅ Merged (#276) |

---

## Remaining issues — investigation plan

### R1. Comfort labels still empty for all hours

**Observation:** Every hour in `todayHours` has `comfort: ""`. Phase 4b was supposed to address this.

**Investigation:**
1. Grep for where `comfort` is assigned in `src/domain/scoring/` — identify the code path.
2. Check whether the comfort evaluator produces values that get overwritten or stripped downstream.
3. Run a targeted unit test for the comfort label function with today's weather data (13°C, wind 14 km/h, humidity 44%) to confirm the function itself returns a non-empty string.
4. If the function works but the pipeline doesn't wire it, trace the data flow from scoring output through to `todayHours` assembly.

**Expected outcome:** Identify whether comfort was implemented but not wired, or whether the Phase 4b PR only documented intent without implementation.

---

### R2. Editorial context sends only 5 fields per hour to the AI

**Observation:** Each hour in the editorial context has just `{hour, score, ct, visK, aod}`. The scoring output has ~40 fields per hour (drama, clarity, mist, wind, humidity, radiation, moon, tags, session scores). The AI is making editorial decisions with minimal context.

**Investigation:**
1. Find where `todayHours` is built for the editorial context — likely in `src/domain/editorial/` or `src/app/`.
2. Check what fields the editorial prompt expects (read the system prompt template).
3. Compare the editorial context shape with what the prompt references — identify any fields the prompt asks about but doesn't receive.
4. Determine whether the sparse shape is intentional (token budget) or an oversight.

**Expected outcome:** A list of fields that should be added to the editorial hour payload, or confirmation that sparse is by design with a documented rationale.

---

### R3. NASA DONKI CME persistently returning 503

**Observation:** DONKI has returned 503 in the last two snapshots (21:25 and 21:32). The fused aurora signal handles it gracefully (`warnings: ["NASA DONKI long-range signal missing"]`), but this means the long-range aurora forecast is permanently absent.

**Investigation:**
1. Check whether DONKI 503 is a known NASA outage — query `https://api.nasa.gov` status page or DONKI changelog.
2. Try the DONKI endpoint manually with different date ranges to isolate whether it's the date range or the endpoint itself.
3. Check if the API key is rate-limited or expired.
4. If DONKI is unreliable, research alternative CME data sources (e.g., NOAA SWPC, SpaceWeatherLive API).

**Expected outcome:** Determine if this is transient (wait it out) or permanent (need an alternative source or graceful permanent removal from aurora scoring weight).

---

### R4. `soil_temperature_0cm` returns all nulls from UKMO

**Observation:** The field was added to the API call (Phase 2b) but Open-Meteo UKMO returns all 120 values as `null` with units `"undefined"`. The `hasFrost` derived feature is permanently disabled.

**Investigation:**
1. Confirm UKMO doesn't support this by checking Open-Meteo's model documentation for UKMO vs ECMWF field availability.
2. Test with `&models=ecmwf_ifs025` to see if ECMWF returns soil temperature.
3. If ECMWF works, decide whether to add a secondary API call for just this field, or combine it with the BLH call (R5).
4. If neither model provides it reliably at this location, remove `soil_temperature_0cm` from the API call and document the limitation.

**Expected outcome:** Either a working secondary data source, or removal of the dead field.

---

### R5. `boundaryLayerHeightM` permanently null — mist quality limited

**Observation:** UKMO doesn't provide `boundary_layer_height`. Mist scoring works via dew-point spread heuristic, but BLH would enable inversion detection (trapped fog layers = best photography conditions).

**Investigation:**
1. Test `https://api.open-meteo.com/v1/forecast?latitude=53.83&longitude=-1.57&hourly=boundary_layer_height&models=ecmwf_ifs025` to confirm ECMWF provides BLH for this location.
2. If it works, design a minimal secondary call: one HTTP node, hourly BLH only, merged into normalized inputs.
3. Estimate token impact of the extra API call on n8n workflow execution time.
4. Check if ECMWF BLH data covers the same 5-day forecast horizon as UKMO.

**Expected outcome:** Confirmed ECMWF BLH availability and a sketch for a secondary API node in the workflow skeleton, or documented decision to defer.

---

### R6. Kp forecast data is stale in editorial context

**Observation:** The `kpForecast` array in the editorial context starts from 2026-03-30 (a week ago). The AI receives 7 days of old Kp data mixed with current. This wastes tokens and could mislead the editorial.

**Investigation:**
1. Find where `kpForecast` is filtered/trimmed before inclusion in the editorial context.
2. Check the NOAA Kp data source — does it return historical + forecast, and is the pipeline failing to filter to forecast-only?
3. Add a filter to only include Kp entries from today onward in the editorial context.

**Expected outcome:** Kp editorial payload trimmed to relevant forecast window (today + 2 days).

---

### R7. Malham Cove alt-location tagged `types: ["poor"]` despite astro score of 81

**Observation:** Alt-location scoring shows Malham Cove with `bestScore: 81` (astro) and `meetsThreshold: true`, but `types: ["poor"]`. The `types` array appears to be based on the daytime score (37), ignoring the strong astro recommendation. This could confuse editorial about whether to recommend a trip.

**Investigation:**
1. Find where `types` is assigned in alt-location scoring — likely in `src/domain/scoring/` or `src/app/`.
2. Check the threshold logic: is `types` derived from `dayScore` only, or should it consider `bestScore` (which includes astro)?
3. If astro-qualifying locations are tagged "poor" based on daytime conditions, the editorial might skip them. Verify the editorial prompt treats `types` and `isAstroWin` independently.

**Expected outcome:** Either fix types to reflect best-case (astro + day), or confirm the editorial handles `isAstroWin: true` + `types: ["poor"]` correctly.

---

### R8. 3 of 5 days rated "Poor — don't bother" — scoring harshness for UK spring

**Observation:** Headline scores range 36–52, with 3/5 days labelled "Poor — don't bother". Today's best hour (20:00, clear sky, golden hour) only scores 52. At 14:00 with 9% cloud, 31km visibility, and 506 W/m² direct radiation, the score is 40. UK spring conditions routinely produce these marginal scores.

**Investigation:**
1. Check the `photoRating` label thresholds — what score ranges map to "Poor", "Marginal", "Good", "Excellent"?
2. Run a histogram of headline scores across the existing API snapshots (3 dates) to see the distribution.
3. Compare with the session scores at the same time — the long-exposure session scores 86 and wildlife 78, but the headline only reaches 52. Understand what drives the gap between session enthusiasm and overall pessimism.
4. Consider whether headline scores should factor in the best session score (not just raw hourly composite).

**Expected outcome:** Either recalibrate rating labels for UK conditions (e.g., "Marginal" at 40+ instead of 50+), or decide that session recommendations are the true signal and headline is deliberately conservative.

---

### R9. `darkSkyStartsAt: "00:00"` for today — looks wrong

**Observation:** Today (6 Apr, Leeds, sunset ~19:55) shows `darkSkyStartsAt: "00:00"` and `bestAstroHour: "23:00"`. Astronomical twilight ends around 21:30 in April at this latitude, so dark sky should start ~21:30, not midnight.

**Investigation:**
1. Find where `darkSkyStartsAt` is computed — likely in sunrise/sunset or astro scoring.
2. Check whether it uses astronomical twilight end or a simpler heuristic.
3. Verify the solar altitude data at 21:00–22:00 to confirm when sun drops below -18°.
4. If it's using `00:00` as a fallback when the value can't be computed, fix the fallback.

**Expected outcome:** `darkSkyStartsAt` reflects actual astronomical twilight end, or documented reason why midnight is used.

---

## Summary

| ID | Issue | Priority | Effort | Tracker |
|----|-------|----------|--------|---------|
| R1 | Comfort labels empty | ✅ Fixed | Wired via `src/lib/outdoor-comfort.ts` | #276 |
| R2 | Editorial hours too sparse | Medium | Medium — field selection + token budget | #278 |
| R3 | DONKI CME 503 | Low | External dependency — monitor or replace | #279 |
| R4 | Soil temp nulls from UKMO | Low | Small — test ECMWF or remove | #280 |
| R5 | BLH null, mist limited | Low | Medium — secondary API call design | #280 |
| R6 | Kp data stale in editorial | Medium | Small — add date filter | #281 |
| R7 | Alt-location types vs astro mismatch | Medium | Small — threshold logic check | #282 |
| R8 | Headline scoring harsh for UK | High | Medium — label recalibration | #283 |
| R9 | darkSkyStartsAt midnight fallback | Low | Small — computation check | #284 |