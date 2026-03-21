# Aperture — Leeds Photo Brief

**Aperture** is a daily photography conditions briefing for Leeds, UK. It combines weather forecasts, astronomical data, and space weather signals to generate a scored, human-readable brief that helps photographers decide *when* to shoot, *what* to shoot, and *where* to go.

The static HTML files in this repository are **generated output**. The generation logic lives in the companion *home* repository. This document explains the full methodology: data sources, scoring, and how everything fits together.

---

## Table of Contents

1. [Overview](#overview)
2. [Generation Process](#generation-process)
3. [Data Sources](#data-sources)
4. [Scoring Methodology](#scoring-methodology)
5. [Location Database](#location-database)
6. [Forecast Certainty](#forecast-certainty)
7. [Aurora / Space Weather](#aurora--space-weather)
8. [Deployment](#deployment)
9. [Archive](#archive)

---

## Overview

Each daily brief covers:

| Section | What it shows |
|---|---|
| **Hero card** | Overall score, best window, sunrise/sunset, moon phase |
| **Astro windows** | Evening and midnight windows rated for astrophotography |
| **Hourly forecast** | Hour-by-hour sky, temp, rain, wind and outdoor score |
| **Daylight utility** | Best daytime window (cloud, wind, rain composite) |
| **Multi-day outlook** | 5-day AM / PM / Astro scores with certainty bands |
| **Nearby locations** | Up to 8 alternative sites ranked by astro score |
| **Long-range option** | An overnight road-trip location when conditions merit it |
| **Kit advisory** | Gear suggestions matched to the winning window |

---

## Generation Process

The home repository runs a daily pipeline that:

1. **Fetches weather data** for Leeds and each location in the database (see [Data Sources](#data-sources)).
2. **Runs astronomical calculations** for the target date (sunrise, sunset, moon phase, moon illumination, dark-sky windows).
3. **Reads live space weather** to obtain the current Kp index.
4. **Scores every hour** of the day across three dimensions: AM light, PM light, and astrophotography (see [Scoring Methodology](#scoring-methodology)).
5. **Scores each location** using the same model applied to its local forecast.
6. **Renders a static HTML page** using a template, inserting all computed values directly into the markup.
7. **Commits the file** to this repository as `index.html` (and a dated copy to `archive/`).
8. **Triggers the deployment workflow**, which publishes the site to GitHub Pages.

The rendered HTML contains no client-side calculation logic — all values are baked in at generation time.

---

## Data Sources

### Weather — Open-Meteo

The primary weather source is [Open-Meteo](https://open-meteo.com/), a free, open-source weather API that aggregates output from multiple numerical weather prediction (NWP) models.

**Variables requested (hourly):**

| Parameter | Use |
|---|---|
| `temperature_2m` | Comfort rating; dew risk calculation |
| `precipitation_probability` | Rain score component |
| `precipitation` | Actual mm/h (cross-check) |
| `cloudcover` | Sky clarity score (combined with `cloudcover_high`, `cloudcover_mid`, `cloudcover_low`) |
| `cloudcover_high` | High cirrus (least harmful to astro) |
| `cloudcover_mid` | Mid-level cloud (moderately harmful) |
| `cloudcover_low` | Low cloud / fog (most harmful) |
| `visibility` | Scored directly; used for astro clarity |
| `windspeed_10m` | Wind score; affects tracking and long exposures |
| `dewpoint_2m` | Compared against `temperature_2m` for dew risk |
| `weathercode` (WMO) | Icon selection |

Forecasts are fetched at the coordinates of each location in the database. The API returns up to 16 days of hourly data; the pipeline uses the next 5 days.

### Astronomical Calculations

Sunrise, sunset, and moon data are calculated locally using established astronomical algorithms (no external API call required). Inputs are date and WGS-84 coordinates. Outputs:

- **Sunrise / Sunset** — civil twilight times in local time (Europe/London).
- **Moon phase** — named phase (New, Waxing Crescent, First Quarter … Full … Waning Crescent) derived from the moon's ecliptic longitude.
- **Moon illumination** — percentage of the lunar disc illuminated at 23:00 local time on the target date.
- **Dark-sky windows** — contiguous night-time periods where moon illumination is below 25 % (or the moon has set).

### Space Weather — NOAA SWPC

Aurora probability is derived from the real-time **Planetary K-index (Kp)**, fetched from [NOAA Space Weather Prediction Center (SWPC)](https://www.swpc.noaa.gov/).

- **Endpoint used:** `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`
- **Value used:** the most recent 3-hour Kp estimate.
- **Leeds aurora threshold:** Kp ≥ 6 (latitude ≈ 53.8 °N).

If the current Kp meets or exceeds the local threshold an aurora alert is inserted into the brief, noting the measured Kp, the local threshold, and recommending a clear northern horizon.

---

## Scoring Methodology

All scores are integers on a **0 – 100** scale and map to four named grades:

| Grade | Range | Colour |
|---|---|---|
| Excellent | 75 – 100 | Green |
| Good | 58 – 74 | Blue |
| Marginal | 42 – 57 | Amber |
| Poor | 0 – 41 | Red |

### AM Light Score

Evaluates conditions around **sunrise ± 90 min** (the golden hour / blue hour window).

Inputs (each normalised 0 – 1 and weighted):

| Factor | Weight | Notes |
|---|---|---|
| Cloud cover (low) | High | Low cloud blocks the horizon glow |
| Cloud cover (mid) | Medium | Breaks in mid cloud can add drama |
| Rain probability | High | Rain degrades light quality |
| Visibility | Medium | Affects haze and colour saturation |
| Wind | Low | Mainly a comfort factor at this score level |

### PM Light Score

Same model as AM Light, applied to **sunset ± 90 min**.

### Astro Score

Evaluates conditions across the **darkest available window** after astronomical twilight ends.

| Factor | Weight | Notes |
|---|---|---|
| Cloud cover (all layers) | Very high | Any cloud degrades the sky |
| Visibility | High | Affects limiting magnitude |
| Wind | Medium | Affects tracking stability and comfort |
| Rain probability | High | Session-ending if > 0 % |
| Moon illumination | High | Higher moon = brighter sky background |
| Dew risk | Medium | Lens fogging shortens sessions |

Dew risk is calculated as the temperature–dew-point spread:

| Spread | Risk |
|---|---|
| > 5 °C | Low |
| 2 – 5 °C | Moderate |
| < 2 °C | High |

### Overall / Hero Score

A weighted composite:

```
Overall = (AM × 0.25) + (PM × 0.25) + (Astro × 0.50)
```

Astro is weighted highest because the brief is primarily aimed at night sky photographers.

### Hourly Outdoor Score

Each hour also receives a standalone **outdoor score** used in the hourly table. This scores purely for daytime outdoor comfort:

| Factor | Weight |
|---|---|
| Rain probability | High |
| Wind speed | Medium |
| Cloud cover | Low |
| Temperature | Low |

The hourly score is also used to derive the **Daylight Utility** window — the 2-hour block with the highest combined outdoor score during daylight hours.

### Location Scores

Each location in the database is scored using the same Astro model applied to its own Open-Meteo forecast. Scores are sorted descending; the top entry becomes the "best nearby option" headline.

---

## Location Database

The database is a static list of curated photography locations within driving distance of Leeds. Each entry records:

| Field | Example |
|---|---|
| Name | Stanage Edge |
| Latitude / Longitude | 53.345, -1.649 |
| Elevation (m) | 457 |
| Drive time from Leeds (min) | 65 |
| Dark-sky designation | No / Yes (Bortle class) |
| Notes | Broad gritstone edges, good northern horizon |

**Current locations:**

| Location | Elevation | Drive |
|---|---|---|
| Stanage Edge | 457 m | 65 min |
| Ladybower Reservoir | — | 65 min |
| Mam Tor | 517 m | 60 min |
| Malham Cove | 386 m | 55 min |
| Sutton Bank | — | 75 min |
| Brimham Rocks | 320 m | 40 min |
| Ribblehead Viaduct | 355 m | 55 min |
| Bolton Abbey | — | 35 min |

**Long-range option** (surfaced when the astro score ≥ 80):

| Location | Elevation | Drive |
|---|---|---|
| Snowdon (Yr Wyddfa) | 1,026 m | 215 min |

---

## Forecast Certainty

Open-Meteo returns ensemble model members alongside the deterministic forecast. The pipeline computes the **inter-quartile spread** (P75 − P25) of the ensemble astro score:

| Spread | Band |
|---|---|
| < 12 pts | High certainty |
| 12 – 24 pts | Fair certainty |
| ≥ 25 pts | Low certainty |

The certainty band and spread value are shown beneath the multi-day astro score to communicate forecast confidence, particularly relevant 3 + days out.

---

## Aurora / Space Weather

Aurora alerts appear when:

```
live_kp >= location_kp_threshold
```

The Kp threshold for a location is derived from its latitude using a standard visibility approximation based on geographic latitude:

```
minimum_kp ≈ (66 - geographic_latitude) / 2
```

For Leeds (geographic latitude ≈ 53.8 °N) this gives a threshold of **Kp 6**.

When an alert fires the brief adds:

- The measured Kp value.
- The local threshold.
- A note to favour a clear northern horizon.
- A reminder that the aurora window coincides with (or conflicts with) the primary astro window.

---

## Deployment

Deployment is fully automated via GitHub Actions (`.github/workflows/deploy.yml`).

**Trigger:** Any push to the `main` branch.

**Steps:**

1. Check out the repository.
2. Configure GitHub Pages.
3. Copy all files (excluding `.git`, `.github`, `site/`) into a `site/` staging directory.
4. Upload the `site/` directory as a GitHub Pages artifact.
5. Deploy the artifact to GitHub Pages.

The live site is available at the repository's GitHub Pages URL.

---

## Archive

Completed briefs are preserved in the `archive/` directory as `YYYY-MM-DD.html` files. The `index.html` at the repository root always reflects the most recently generated brief.

---

*Generated by the Aperture home repository and published to GitHub Pages.*
