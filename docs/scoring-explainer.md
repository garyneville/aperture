# How Aperture Scores Photography Conditions

Aperture is a weather-to-photography scoring system. It fetches forecast data from multiple providers, scores every hour of the forecast window on a 0–100 scale, selects the best shooting windows, recommends photography session types, and generates an editorial brief.

This document explains how the numbers work — from raw weather data to the scores and recommendations you see in the daily brief.

---

## Data Sources

Aperture pulls from 11 external data sources to build the scoring picture. All weather data comes from free public APIs; no paid keys are required for the forecast inputs.

| # | Source | Endpoint | What It Provides |
|---|--------|----------|------------------|
| 1 | Open-Meteo Weather (UKMO) | `api.open-meteo.com/v1/forecast` | Cloud cover (low / mid / high / total), visibility, temperature, humidity, dewpoint, precipitation, wind speed and gusts, CAPE, vapour pressure deficit, direct and diffuse radiation, soil temperature |
| 2 | Open-Meteo Precip & Lightning | `api.open-meteo.com/v1/forecast` | Precipitation probability, lightning potential (best-match model, not UKMO-pinned) |
| 3 | Open-Meteo Air Quality | `air-quality-api.open-meteo.com/v1/air-quality` | Aerosol optical depth (AOD), dust, European AQI, PM2.5, UV index, pollen (alder, birch, grass) |
| 4 | Open-Meteo Ensemble (ECMWF) | `ensemble-api.open-meteo.com/v1/ensemble` | Cloud-cover ensemble members for uncertainty / confidence quantification |
| 5 | Open-Meteo Marine | `marine-api.open-meteo.com/v1/marine` | Wave height, swell height, swell period, swell direction |
| 6 | Open-Meteo Satellite Radiation | `api.open-meteo.com/v1/forecast` (ICON) | Shortwave radiation instant values for nowcast clearing / thickening detection |
| 7 | Aviation Weather METAR | `aviationweather.gov/api/data/metar` | Real-time ground-truth observation: weather type, visibility, cloud base, dew-point spread |
| 8 | SunsetHue | `api.sunsethue.com/forecast` | Sunset colour-quality prediction |
| 9 | AuroraWatch UK | `aurorawatch.lancs.ac.uk/api/0.1/status.xml` | Real-time geomagnetic activity status |
| 10 | NOAA K-Index | `services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json` | Planetary K-index aurora forecast |
| 11 | NASA DONKI | `api.nasa.gov/DONKI/CME` | Coronal mass ejection events (space weather) |

### AI Editorial Providers

After scoring, the system calls an AI provider to write the narrative brief:

| Provider | Role |
|----------|------|
| Groq | Primary editorial generation (fast inference) |
| Google Gemini | Fallback editorial + optional creative-spark "inspire" chain |

Provider priority is config-driven. If the primary fails or returns low-quality output, the system falls back automatically.

---

## Hourly Scoring (0–100)

Every forecast hour is scored independently. The final hourly score is a **weighted blend** of up to four sub-scores, with the weights changing by time of day.

### Sub-Scores

Each sub-score is individually clamped to 0–100.

#### Drama (light richness and colour potential)

Rewards conditions that produce vivid, colourful skies.

- Golden-hour base bonus (+30) or blue-hour base bonus (+18)
- High cloud in the 15–80 % range (the "canvas" for colour) — up to +25
- Mid cloud 10–50 % — up to +10
- Penalty for heavy low cloud in daylight (> 70 %) — −15
- Bonus for recent rain followed by dryness (washed sky) — +10
- Precipitation risk > 0.5 mm — −20
- Azimuth obstruction penalties (hills / buildings blocking the light path) — −8 to −22

#### Clarity (transparency and contrast)

Rewards clean, sharp atmospheric conditions.

- Visibility > 30 km: +25; 15–30 km: +15; < 2 km: −15
- Aerosol optical depth (AOD) via a non-linear curve — lower is better
- Dust > 20 µg/m³: −10
- Humidity < 60 %: +5; > 85 %: −5
- Total precipitable water < 15 mm: +5; > 30 mm: scaled penalty
- Clear-sky visibility bonus: +6 to +12 when cloud < 10 % and visibility > 20 km
- Golden-hour bonus: +10

#### Mist (atmospheric depth and mood)

Rewards conditions that produce fog, mist, or atmospheric layering.

- Visibility 200–1500 m (optimal mist window): +30
- Visibility 1500–4000 m: +10
- Dew-point depression < 2 °C (fog likely): +20; 2–4 °C: +10
- Calm wind < 5 kph: +15; 5–10 kph: +5
- Recent rain then dry: +10

#### Astro (night-sky quality)

Only computed when the sun is below −18° elevation (astronomical darkness).

- Moon phase and altitude adjustment — bright moon above the horizon degrades the score; moon below the horizon suppresses the penalty
- Clear sky (cloud < 10 %): +30; 10–30 %: +10; > 60 %: −20
- Visibility > 25 km: +15
- AOD penalty above 0.3
- Good air quality (AQI < 20): +10
- Site darkness bonus based on Bortle class

### Time-of-Day Weights

The sub-scores are blended with different weights depending on when the hour falls:

| Time of Day | Drama | Clarity | Mist | Astro |
|-------------|------:|--------:|-----:|------:|
| **Dawn / Golden AM** | 30 % | 40 % | 30 % | — |
| **Dusk / Golden PM** | 55 % | 30 % | 15 % | — |
| **Night** | 10 % | — | 15 % | 75 % |
| **Midday** | * | * | * | — |

\* At midday the three daytime sub-scores are sorted highest-to-lowest and weighted **55 / 35 / 10** — so the strongest signal always dominates regardless of which sub-score it is.

Blue-hour timestamps use the same weights as their corresponding golden-hour session (AM or PM).

The result is clamped to 0–100. This is the **hourly score** displayed in the brief.

---

## From Hourly Scores to the Daily Score

> **Key point:** the daily "photo score" is the **peak hourly score** from the best golden-hour or blue-hour timestamp, plus a small duration bonus. It is _not_ an average, a sum, or a differently weighted aggregate.

### Exact formula

```
photoScore = min(100, bestGoldenBlueHourScore + durationBonus)
```

| Term | Definition |
|------|-----------|
| `bestGoldenBlueHourScore` | The single highest hourly score among all golden-hour and blue-hour timestamps for that day. If there are no golden/blue hours, all daytime hours are considered instead. |
| `durationBonus` | A small uplift (0–8 points) that rewards days with longer golden-hour windows. Calculated as: `min(8, round(max(0, (totalGoldenMinutes − 90) / 8)))`. A day with 90 minutes of combined AM + PM golden hour gets +0; each additional 8 minutes adds +1, capped at +8. |

### Why can the daily score exceed the peak hourly score?

Because of the duration bonus. A day with a peak hourly score of 55 and a total golden-hour window of 130 minutes would receive a +5 bonus, producing a daily score of 60. The brief may show:

- Peak hourly score: **55**
- Daily photo score: **60**

The bonus recognises that a longer window gives photographers more flexibility — even if no single hour is outstanding, having 2+ hours of good light is operationally valuable.

### Other daily score fields

| Field | How it's computed |
|-------|-------------------|
| `astroScore` | Peak astro sub-score from the night hours (not the blended night score — the raw astro component). |
| `headlineScore` | `max(bestGoldenBlueHourScore, bestNightHourScore)` — the highest score across both day and night, used as the overall day headline. |
| `amScore` | Peak AM golden/blue hour score + half the duration bonus. |
| `pmScore` | Peak PM golden/blue hour score + half the duration bonus. |

---

## Shooting Windows

Hourly scores are grouped into contiguous **shooting windows** — blocks of consecutive hours where conditions are good enough to go out and shoot.

### Window selection

1. **Threshold grouping:** consecutive hours scoring ≥ 45 are merged into a window. The window's peak is the highest hourly score within it.
2. **Expansion:** single-hour daylight windows are expanded to include adjacent hours for a more useful time range.
3. **Fallback:** if no hours reach the 45-point threshold:
   - The single best hour is offered as a fallback window.
   - If a session evaluator identifies a strong opportunity (e.g. "good for astrophotography" at score 38), that session-fallback window may be preferred.
4. **Labelling:** each window receives a human-readable label based on its time phase ("Golden hour", "Pre-dawn", "Blue hour", "Evening", etc.) and photography tags.

Up to **three windows** are shown per day, sorted by peak score.

### "Don't bother" flag

If no window reaches the photo threshold (48) and there is no strong session fallback, the day is flagged as not worth a trip. The brief communicates this with a "don't bother" signal — the AI editorial adjusts its tone accordingly.

---

## Session Recommendations

Beyond the general score, Aperture evaluates each hour against **nine specialist photography sessions**. Each session has its own scoring formula tuned to the conditions that matter for that type of photography.

| Session | What it rewards | Key requirements |
|---------|----------------|-----------------|
| **Golden Hour** | Sunrise / sunset colour and drama | Golden or blue phase flag; weighs cloud canvas (bell curve around 20–70 % high cloud), drama, clarity, crepuscular rays |
| **Astro** | Night-sky quality for astrophotography | Astronomical darkness (solar alt < −18°); moon washout penalty, cloud < 60 %, transparency, seeing, Bortle darkness |
| **Mist** | Fog and atmospheric mood | Mist sub-score > 30, dew-point depression < 4 °C |
| **Storm** | Dramatic weather photography | Lightning risk > 25 % or CAPE > 800 J/kg; cloud depth, wind shear |
| **Seascape** | Coastal / marine photography | Swell height > 1.5 m and swell period > 6 s; wave energy, wind limits, visibility |
| **Long Exposure** | Smooth water / motion blur | Strong wind (> 15 kph) or moving-water signals; cloud softness |
| **Urban** | City photography | Clarity > 40, not raining; golden/blue hour enhancement |
| **Wildlife** | Animal / nature photography | Daylight soft-light conditions; uses diffuse-to-direct radiation ratio when available |
| **Waterfall** | Waterfall photography | Recent rainfall > 2 mm or humidity ≥ 90 %; wind ≤ 25 kph, visibility ≥ 2 km |

Each evaluator returns:

- A **score** (0–100)
- A **confidence level** (high / medium / low)
- **Reasons** (what's driving the score)
- **Warnings** (conditions that may cause problems)

The top-scoring session is surfaced as the primary recommendation. When the primary confidence is medium or low, a "Plan B" spur suggestion is generated as an alternative.

---

## Safety and Environmental Alerts

Aperture scans the forecast hours for conditions that affect safety or image quality and attaches alerts to the brief.

| Alert | Trigger | Level |
|-------|---------|-------|
| ⚡ Lightning | Peak lightning risk ≥ 50 % | warn |
| ⚡ Lightning (low) | Peak lightning risk 10–49 % | info |
| 😷 Air Quality | European AQI > 100 | warn |
| 🌿 Pollen | Peak pollen > 100 grains/m³ | info |
| 🌫️ Saharan Dust | AOD > 0.4 | warn |
| ☀️ UV Exposure | UV index ≥ 8 and session > 2 hours | info |

Alerts are sorted by severity (warn before info) and deduplicated by category.

---

## Confidence and Ensemble Data

The scoring system uses ECMWF ensemble cloud-cover data to quantify forecast uncertainty. Ensemble members provide multiple plausible scenarios; the standard deviation across members indicates how confident the forecast is.

- **Low spread** → high confidence in the cloud prediction → scoring trusts the numbers
- **High spread** → uncertain cloud forecast → session evaluators penalise their confidence rating

This is why the brief sometimes says "high confidence" or "low confidence" alongside a session recommendation — it reflects how much the cloud forecast agrees with itself across ensemble members.

---

## Alternative Locations

Aperture scores nearby alternative locations using a simplified version of the same hourly scoring. Each alt location receives:

- **bestScore** — peak day or astro score
- **bestDayHour / bestAstroHour** — time of best conditions
- **types** — photography tags (e.g. "landscape", "astrophotography")
- **isAstroWin** — whether astrophotography outperforms daytime photography at that site (requires a darker site than the home location)

If an alternative location scores significantly higher than home, the brief highlights it as a drive-to option.

---

## Editorial Generation

After scoring, the system assembles a prompt with the full forecast context and sends it to an AI provider (Groq primary, Gemini fallback). The AI generates:

1. **Main narrative** — a written brief interpreting the scores, windows, and recommendations in natural language
2. **Composition bullets** — 3–5 specific shot ideas for the day
3. **Week standout** — the single best day across the 7-day forecast window
4. **Spur suggestion** — a "Plan B" alternative when confidence is mixed
5. **Creative spark** — an optional artistic paragraph (via a separate Gemini call)

The editorial is validated against the scored data (factual checks, style checks) and falls back to a template if the AI output is unreliable.

---

## Output Formats

The scored forecast and editorial are rendered into four formats:

| Format | Delivery | Description |
|--------|----------|-------------|
| **Email** | SendGrid | Full HTML brief with hero score, shooting windows, kit advisory, hourly outlook, forecast cards, and debug traces |
| **Site** | GitHub Pages | Static HTML page with modular sections (hero, signals, windows, sessions, hourly table, forecasts) |
| **Telegram** | Telegram Bot API | Condensed HTML message with emoji indicators for mobile |
| **JSON** | In-workflow | Machine-readable `BriefJson` contract with all scored data for downstream consumers |

---

## Glossary

| Term | Meaning |
|------|---------|
| **Hourly score** | 0–100 blended score for a single forecast hour |
| **Photo score** | Daily score: peak golden/blue hourly score + duration bonus |
| **Astro score** | Daily score: peak astro sub-score from night hours |
| **Headline score** | Daily score: max of photo and night scores |
| **Window** | Contiguous block of hours scoring ≥ 45 |
| **Session** | Specialist photography type (golden hour, astro, mist, etc.) |
| **Duration bonus** | 0–8 point uplift for days with longer golden-hour windows |
| **Don't bother** | Flag when no window reaches the photo threshold (48) |
| **CAPE** | Convective Available Potential Energy — storm energy metric |
| **AOD** | Aerosol Optical Depth — atmospheric particle loading |
| **Bortle class** | Light-pollution scale (1 = pristine dark, 9 = inner city) |
| **Dew-point depression** | Gap between temperature and dew point — small gap means fog likely |
| **Ensemble spread** | Standard deviation across forecast model runs — measures uncertainty |
