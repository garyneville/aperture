import { findDarkSkyStart, getMoonMetrics, getSolarAltitude, moonScoreAdjustment, moonState } from '../../lib/astro.js';
import { HOME_SITE_DARKNESS, astroDarknessBonus } from '../../lib/site-darkness.js';
import { clamp, avg, solarElevation, aodClarity, astroAodPenalty } from '../../lib/utils.js';
import { emptyDebugContext, type DebugContext } from '../../lib/debug-context.js';
import { serializeDebugPayload, upsertDebugPayloadSnapshot } from '../../lib/debug-payload.js';
import { evaluateBuiltInSessions, summarizeSessionRecommendations } from './sessions/index.js';
import { deriveHourFeatures, type DerivedHourFeatureInput } from './features/derive-hour-features.js';
import { DEFAULT_HOME_LOCATION } from '../../types/home-location.js';
import type { SessionRecommendationSummary } from '../../types/session-score.js';

// ── Input interfaces ─────────────────────────────────────────────────────────

export interface WeatherData {
  hourly?: {
    time?: string[];
    cloudcover?: number[];
    cloudcover_low?: number[];
    cloudcover_mid?: number[];
    cloudcover_high?: number[];
    visibility?: number[];
    temperature_2m?: number[];
    relativehumidity_2m?: number[];
    dewpoint_2m?: number[];
    precipitation?: number[];
    windspeed_10m?: number[];
    windgusts_10m?: number[];
    winddirection_10m?: number[];
    cape?: number[];
    vapour_pressure_deficit?: number[];
    total_column_integrated_water_vapour?: number[];
    boundary_layer_height?: number[];
  };
  daily?: {
    sunrise: string[];
    sunset: string[];
    moonrise?: string[];
    moonset?: string[];
  };
}

export interface AirQualityData {
  hourly?: {
    time?: string[];
    aerosol_optical_depth?: number[];
    dust?: number[];
    european_aqi?: number[];
    uv_index?: number[];
  };
}

export interface PrecipProbData {
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
  };
}

export interface SunsetHueEntry {
  time?: string;
  type?: string;
  quality?: number;
  quality_text?: string;
  direction?: string;
  magics?: {
    golden_hour?: [string, string];
    blue_hour?: [string, string];
  };
}

export interface EnsembleData {
  hourly?: Record<string, (number | null)[] | string[]>;
}

export interface AzimuthScanResult {
  occlusionRisk?: number | null;
  lowRisk?: number | null;
  horizonGapPct?: number | null;
  gapQualityScore?: number | null;
  clearPathBonus?: number;
}

export interface AzimuthByPhase {
  sunrise?: Record<string, AzimuthScanResult>;
  sunset?: Record<string, AzimuthScanResult>;
}

export interface ScoreHoursInput {
  lat: number;
  lon: number;
  timezone?: string;
  weather: WeatherData;
  airQuality: AirQualityData;
  precipProb: PrecipProbData;
  metarRaw: Array<{ rawOb?: string }> | { rawOb?: string } | string;
  sunsetHue: SunsetHueEntry[] | SunsetHueEntry;
  ensemble: EnsembleData;
  azimuthByPhase: AzimuthByPhase;
}

// ── Output interfaces ────────────────────────────────────────────────────────

export interface ScoredHour {
  ts: string;
  t: string;
  hour: string;
  score: number;
  drama: number;
  clarity: number;
  mist: number;
  astro: number;
  crepuscular: number;
  shQ: number | null;
  cl: number;
  cm: number;
  ch: number;
  ct: number;
  visK: number;
  aod: number;
  tpw: number;
  wind: number;
  windDir: number | null;
  gusts: number;
  tmp: number;
  hum: number;
  dew: number;
  pp: number;
  pr: number;
  vpd: number;
  boundaryLayerHeightM?: number | null;
  horizonGapPct?: number | null;
  azimuthRisk: number | null;
  isGolden: boolean;
  isGoldAm: boolean;
  isGoldPm: boolean;
  isBlue: boolean;
  isBlueAm: boolean;
  isBluePm: boolean;
  isNight: boolean;
  moon: number;
  moonAltDeg: number | null;
  solarAltDeg: number | null;
  uv: number;
  tags: string[];
}

export interface CarWash {
  score: number;
  rating: string;
  label: string;
  start: string;
  end: string;
  wind: number;
  pp: number;
  tmp: number;
}

export interface DaySummary {
  dateKey: string;
  dayLabel: string;
  dayIdx: number;
  hours: ScoredHour[];
  photoScore: number;
  headlineScore: number;
  photoEmoji: string;
  photoRating: string;
  bestPhotoHour: string;
  bestTags: string;
  carWash: CarWash;
  sunrise: string;
  sunset: string;
  shSunsetQuality: number | null;
  shSunriseQuality: number | null;
  shSunsetText: string | null;
  sunDirection: number | null;
  crepRayPeak: number;
  confidence: string;
  confidenceStdDev: number | null;
  durationBonus: number;
  amConfidence: string;
  amConfidenceStdDev: number | null;
  pmConfidence: string;
  pmConfidenceStdDev: number | null;
  astroConfidence: string;
  astroConfidenceStdDev: number | null;
  goldAmMins: number;
  goldPmMins: number;
  amScore: number;
  pmScore: number;
  astroScore: number;
  bestAstroHour?: string | null;
  darkSkyStartsAt?: string | null;
  bestAmHour: string;
  bestPmHour: string;
  sunriseOcclusionRisk: number | null;
  sunsetOcclusionRisk: number | null;
}

export interface ScoreHoursOutput {
  todayHours: ScoredHour[];
  dailySummary: DaySummary[];
  metarNote: string;
  sessionRecommendation: SessionRecommendationSummary;
  debugContext: DebugContext;
}

// ── Internals ────────────────────────────────────────────────────────────────

interface DateEntry { ts: string; i: number }

interface EnsEntry { mean: number; stdDev: number }

function toFeatureInputFromScoredHour(hour: ScoredHour, ensemble?: EnsEntry | null): DerivedHourFeatureInput {
  return {
    hourLabel: hour.hour,
    overallScore: hour.score,
    dramaScore: hour.drama,
    clarityScore: hour.clarity,
    mistScore: hour.mist,
    astroScore: hour.astro,
    crepuscularScore: hour.crepuscular,
    cloudLowPct: hour.cl,
    cloudMidPct: hour.cm,
    cloudHighPct: hour.ch,
    cloudTotalPct: hour.ct,
    visibilityKm: hour.visK,
    aerosolOpticalDepth: hour.aod,
    precipProbabilityPct: hour.pp,
    humidityPct: hour.hum,
    temperatureC: hour.tmp,
    dewPointC: hour.dew,
    windKph: hour.wind,
    gustKph: hour.gusts,
    windDirectionDeg: hour.windDir,
    moonIlluminationPct: hour.moon,
    moonAltitudeDeg: hour.moonAltDeg ?? null,
    solarAltitudeDeg: hour.solarAltDeg ?? null,
    isNight: hour.isNight,
    isGolden: hour.isGolden,
    isBlue: hour.isBlue,
    tags: hour.tags,
    azimuthOcclusionRiskPct: hour.azimuthRisk,
    azimuthLowCloudRiskPct: null,
    clearPathBonusPts: null,
    boundaryLayerHeightM: hour.boundaryLayerHeightM ?? null,
    horizonGapPct: hour.horizonGapPct ?? null,
    ensembleCloudStdDevPct: ensemble ? Math.round(ensemble.stdDev) : null,
    ensembleCloudMeanPct: ensemble ? Math.round(ensemble.mean) : null,
  };
}

// Degrees below horizon at which astronomical twilight ends (sky is truly dark)
const ASTRO_DARK_ELEVATION = -18;

function debugConfidenceLabel(confidence: string | null | undefined): string | null {
  if (!confidence || confidence === 'unknown') return confidence ?? null;
  if (confidence === 'medium') return 'Fair';
  if (confidence === 'high') return 'High';
  if (confidence === 'low') return 'Low';
  return confidence;
}

/**
 * scoreAllDays — pure extraction of the n8n "Score Hours" node logic.
 *
 * @param input  All raw API data needed for scoring.
 * @param now    The current date (defaults to new Date(); pass explicitly for tests).
 */
export function scoreAllDays(input: ScoreHoursInput, now?: Date): ScoreHoursOutput {
  const { lat: LAT, lon: LON, weather: w, airQuality: aq, precipProb: ppData, ensemble: ensData, azimuthByPhase: azimuthByPhaseRaw } = input;
  const azimuthByPhase = azimuthByPhaseRaw || {};
  const timezone = input.timezone || DEFAULT_HOME_LOCATION.timezone;

  // SunsetHue lookup
  const shByDay: Record<string, SunsetHueEntry> = {};
  const shArr = Array.isArray(input.sunsetHue) ? input.sunsetHue : [];
  shArr.forEach(e => {
    if (!e.time) return;
    shByDay[`${e.time.substring(0, 10)}_${e.type}`] = e;
  });

  // AQ lookup
  const aqIdx: Record<string, number> = {};
  (aq.hourly?.time || []).forEach((t, i) => { aqIdx[t] = i; });

  // Precip prob lookup
  const ppIdx: Record<string, number> = {};
  (ppData.hourly?.time || []).forEach((t, i) => { ppIdx[t] = i; });

  // Ensemble: compute stdDev of cloudcover across members per timestamp
  const ensIdx: Record<string, EnsEntry> = {};
  const ensMemberKeys = Object.keys(ensData?.hourly || {}).filter(k => k.startsWith('cloudcover_member'));
  (ensData?.hourly?.time as string[] || []).forEach((ts: string, i: number) => {
    if (!ensMemberKeys.length) return;
    const vals = ensMemberKeys
      .map(k => (ensData.hourly![k] as (number | null)[])?.[i] ?? null)
      .filter((v): v is number => v !== null);
    if (!vals.length) return;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const stdDev = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length);
    ensIdx[ts] = { mean, stdDev };
  });

  const tod = now ?? new Date();
  const todayKey = tod.toLocaleDateString('en-CA', { timeZone: timezone });
  const featureInputsByTs: Record<string, DerivedHourFeatureInput> = {};

  const byDate: Record<string, DateEntry[]> = {};
  (w.hourly?.time || []).forEach((ts, i) => {
    const k = new Date(ts).toLocaleDateString('en-CA', { timeZone: timezone });
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push({ ts, i });
  });

  const sortedDates = Object.keys(byDate).sort();

  // ── scoreDay ─────────────────────────────────────────────────────────────

  function scoreDay(dateKey: string, dayIdx: number): DaySummary {
    const sunriseD = new Date(w.daily!.sunrise[dayIdx]);
    const sunsetD  = new Date(w.daily!.sunset[dayIdx]);

    const shSunrise = shByDay[`${dateKey}_sunrise`];
    const shSunset  = shByDay[`${dateKey}_sunset`];
    const shSunriseQ = shSunrise?.quality ?? null;
    const shSunsetQ  = shSunset?.quality  ?? null;

    const goldAmS = shSunrise?.magics?.golden_hour?.[0] ? new Date(shSunrise.magics.golden_hour[0]) : new Date(+sunriseD - 10 * 60000);
    const goldAmE = shSunrise?.magics?.golden_hour?.[1] ? new Date(shSunrise.magics.golden_hour[1]) : new Date(+sunriseD + 65 * 60000);
    const goldPmS = shSunset?.magics?.golden_hour?.[0]  ? new Date(shSunset.magics.golden_hour[0])  : new Date(+sunsetD  - 65 * 60000);
    const goldPmE = shSunset?.magics?.golden_hour?.[1]  ? new Date(shSunset.magics.golden_hour[1])  : new Date(+sunsetD  + 5  * 60000);
    const blueAmS = shSunrise?.magics?.blue_hour?.[0]   ? new Date(shSunrise.magics.blue_hour[0])   : new Date(+sunriseD - 30 * 60000);
    const bluePmE = shSunset?.magics?.blue_hour?.[1]    ? new Date(shSunset.magics.blue_hour[1])    : new Date(+sunsetD  + 30 * 60000);
    const nightS  = new Date(+sunsetD + 90 * 60000);
    const sunDirection = shSunset?.direction != null
      ? (parseFloat(String(shSunset.direction)) || null)
      : null;

    // Golden-hour duration bonus — longer twilight = more opportunity
    // Baseline 90 min total; +1pt per 8 min above that, capped at +8
    const goldAmMins = (+goldAmE - +goldAmS) / 60000;
    const goldPmMins = (+goldPmE - +goldPmS) / 60000;
    const totalGoldMins = goldAmMins + goldPmMins;
    const durationBonus = Math.min(8, Math.round(Math.max(0, (totalGoldMins - 90) / 8)));

    // Ensemble confidence — per-session and overall
    function computeConf(timestamps: string[]): { confidence: string; confidenceStdDev: number | null } {
      const ens = timestamps.map(ts => ensIdx[ts]).filter(Boolean);
      if (!ens.length) return { confidence: 'unknown', confidenceStdDev: null };
      const avgStdDev = ens.reduce((s, e) => s + e.stdDev, 0) / ens.length;
      return {
        confidence: avgStdDev < 12 ? 'high' : avgStdDev < 25 ? 'medium' : 'low',
        confidenceStdDev: Math.round(avgStdDev),
      };
    }
    const amTimesEns = (byDate[dateKey] || []).filter(({ ts }) => {
      const t = new Date(ts); return t >= goldAmS && t <= goldAmE;
    }).map(({ ts }) => ts);
    const pmTimesEns = (byDate[dateKey] || []).filter(({ ts }) => {
      const t = new Date(ts); return t >= goldPmS && t <= goldPmE;
    }).map(({ ts }) => ts);
    const amConf = computeConf(amTimesEns);
    const pmConf = computeConf(pmTimesEns);
    // Night-hour ensemble confidence (drives astro recommendation quality)
    const nightTimesEns = (byDate[dateKey] || []).filter(({ ts }) => {
      const t = new Date(ts);
      return t < blueAmS || t > bluePmE;
    }).map(({ ts }) => ts);
    const astroConf = computeConf(nightTimesEns);
    // Overall confidence (backward compat)
    const goldTimes = [...amTimesEns, ...pmTimesEns];
    const goldEns = goldTimes.map(ts => ensIdx[ts]).filter(Boolean);
    let confidence = 'unknown';
    let confidenceStdDev: number | null = null;
    if (goldEns.length) {
      const avgStdDev = goldEns.reduce((s, e) => s + e.stdDev, 0) / goldEns.length;
      confidenceStdDev = Math.round(avgStdDev);
      confidence = avgStdDev < 12 ? 'high' : avgStdDev < 25 ? 'medium' : 'low';
    }

    const hours: ScoredHour[] = [];
    const nightTimestamps = (byDate[dateKey] || [])
      .map(({ ts }) => ts)
      .filter(ts => {
        const t = new Date(ts);
        return t < blueAmS || t > bluePmE;
      });
    const darkSkyStartTs = findDarkSkyStart(nightTimestamps, LAT, LON);
    const darkSkyStartsAt = darkSkyStartTs
      ? new Date(darkSkyStartTs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
      : null;
    (byDate[dateKey] || []).forEach(({ ts, i }) => {
      const t = new Date(ts);

      const cl  = w.hourly!.cloudcover_low?.[i]   ?? 50;
      const cm  = w.hourly!.cloudcover_mid?.[i]   ?? 50;
      const ch  = w.hourly!.cloudcover_high?.[i]  ?? 50;
      const ct  = w.hourly!.cloudcover?.[i]       ?? 50;
      const visM = w.hourly!.visibility?.[i]      ?? 10000;
      const visK = visM / 1000;
      const tmp  = w.hourly!.temperature_2m?.[i]  ?? 10;
      const hum  = w.hourly!.relativehumidity_2m?.[i] ?? 70;
      const dew  = w.hourly!.dewpoint_2m?.[i]     ?? 5;
      const ppI  = ppIdx[ts] ?? -1;
      const pp   = ppI >= 0 ? (ppData.hourly!.precipitation_probability?.[ppI] ?? 0) : 0;
      const pr   = w.hourly!.precipitation?.[i]   ?? 0;
      const spd  = w.hourly!.windspeed_10m?.[i]   ?? 0;
      const gst  = w.hourly!.windgusts_10m?.[i]   ?? 0;
      const wdir = w.hourly!.winddirection_10m?.[i] ?? null;
      const cap  = w.hourly!.cape?.[i]            ?? 0;
      const vpd  = w.hourly!.vapour_pressure_deficit?.[i] ?? 0.5;
      const prev = i > 0 ? (w.hourly!.precipitation?.[i - 1] ?? 0) : 0;
      // TPW — total precipitable water (mm)
      const tpw  = w.hourly!.total_column_integrated_water_vapour?.[i] ?? 20;
      const blh  = w.hourly!.boundary_layer_height?.[i] ?? null;

      const qi   = aqIdx[ts] ?? -1;
      const aod  = qi >= 0 ? (aq.hourly!.aerosol_optical_depth?.[qi]  ?? 0.2) : 0.2;
      const dust = qi >= 0 ? (aq.hourly!.dust?.[qi]                    ?? 0)   : 0;
      const aqi  = qi >= 0 ? (aq.hourly!.european_aqi?.[qi]            ?? 25)  : 25;
      const uv   = qi >= 0 ? (aq.hourly!.uv_index?.[qi]                ?? 0)   : 0;

      const isGoldAm = t >= goldAmS && t <= goldAmE;
      const isGoldPm = t >= goldPmS && t <= goldPmE;
      const isBlueAm = t >= blueAmS && t < goldAmS;
      const isBluePm = t > goldPmE  && t <= bluePmE;
      const isGolden = isGoldAm || isGoldPm;
      const isBlue   = isBlueAm || isBluePm;
      const isNight  = t < blueAmS || t > bluePmE;

      // Temporal phase — key for asymmetric cloud scoring
      const isPostSunset = isGoldPm && t >= sunsetD;

      const azimuthPhase = (isGoldAm || isBlueAm) ? 'sunrise' : (isGoldPm || isBluePm) ? 'sunset' : null;
      const azimuthScan = azimuthPhase ? (azimuthByPhase as Record<string, Record<string, AzimuthScanResult>>)?.[azimuthPhase]?.[ts] || null : null;
      const azimuthRisk = azimuthScan?.occlusionRisk ?? null;
      const azimuthLowRisk = azimuthScan?.lowRisk ?? null;
      const horizonGapPct = azimuthScan?.horizonGapPct ?? null;

      const moonMetrics = getMoonMetrics(+t, LAT, LON);
      const moon = moonMetrics.illumination;
      const solarAltDeg = getSolarAltitude(+t, LAT, LON);
      const shQ   = isGoldAm ? shSunriseQ : isGoldPm ? shSunsetQ : null;
      const shBoost = shQ !== null ? Math.round(shQ * 25) : 0;

      // ── DRAMA ──────────────────────────────────────────────────────────
      let drama = 0;
      if (isGolden) drama += 30;
      if (isBlue)   drama += 18;

      // High cloud: post-sunset gets a bigger reward — cirrus still glowing
      if (isPostSunset) {
        if (ch >= 15 && ch <= 80) drama += 25; else if (ch > 80) drama += 10;
      } else {
        if (ch >= 20 && ch <= 70) drama += 20; else if (ch > 70) drama += 8;
      }

      if (cm >= 10 && cm <= 50) drama += 10; else if (cm > 80) drama -= 5;

      // Low cloud: temporal asymmetry
      if (isPostSunset) {
        if (cl > 85) drama -= 5;
      } else {
        if (cl < 20) drama += 10; else if (cl > 70) drama -= 15;
      }

      if (cap > 500) drama += 5;
      if (prev > 0.5 && pr < 0.1) drama += 10;
      if (pr > 0.5)  drama -= 20;

      // Clear-sky bonus: near-cloudless golden/blue hours still produce clean, directional light
      if ((isGolden || isBlue) && ct < 15) drama += 12;
      else if ((isGolden || isBlue) && ct < 30) drama += 5;

      // Solar azimuth scan
      if (azimuthRisk !== null) {
        if (azimuthRisk > 75) drama -= 22;
        else if (azimuthRisk > 60) drama -= 14;
        else if (azimuthRisk > 45) drama -= 8;
        else if (azimuthRisk < 20) drama += 8;
        else if (azimuthRisk < 32) drama += 4;
        drama += azimuthScan?.clearPathBonus ?? 0;
      }
      drama = clamp(drama + shBoost);

      // ── CLARITY ────────────────────────────────────────────────────────
      let clarity = 0;
      if (visK > 30) clarity += 25; else if (visK > 15) clarity += 15; else if (visK < 2) clarity -= 15;
      clarity += aodClarity(aod);
      if (dust > 20) clarity -= 10;
      if (hum < 60)  clarity += 5;  else if (hum > 85) clarity -= 5;
      if (uv > 7)    clarity -= 10;
      if (isGolden)  clarity += 10;
      if (tpw < 15)       clarity += 5;
      else if (tpw > 30)  clarity -= Math.round((tpw - 30) / 4);
      if (azimuthLowRisk !== null && azimuthLowRisk > 60) clarity -= 4;
      // Clear-sky visibility bonus: cloudless sky + good visibility partially offsets cloud drama deficit
      if (ct < 20 && visK > 10) clarity += 12;
      else if (ct < 20 && visK > 5) clarity += 6;
      clarity = clamp(clarity);

      // ── MIST / MOOD ───────────────────────────────────────────────────
      let mist = 0;
      if (visM >= 200 && visM <= 1500)  mist += 30;
      else if (visM > 1500 && visM <= 4000) mist += 10;
      if ((tmp - dew) < 2)  mist += 20; else if ((tmp - dew) < 4) mist += 10;
      if (spd < 5)          mist += 15; else if (spd < 10) mist += 5;
      if (prev > 0.5 && pr < 0.1) mist += 10;
      mist = clamp(mist);

      // ── ASTRO ─────────────────────────────────────────────────────────
      let astro = 0;
      if (isNight && solarAltDeg < ASTRO_DARK_ELEVATION) {
        astro += moonScoreAdjustment(moonMetrics);
        if (ct < 10)    astro += 30; else if (ct < 30)    astro += 10; else if (ct > 60)    astro -= 20;
        if (visK > 25)  astro += 15;
        astro -= astroAodPenalty(aod);
        if (aqi < 20)   astro += 10;
        astro += astroDarknessBonus(HOME_SITE_DARKNESS);
        astro = clamp(astro);
      }

      // ── CREPUSCULAR RAYS ──────────────────────────────────────────────
      let crepuscular = 0;
      if (isGolden) {
        const elev = solarElevation(+t, LAT, LON);
        if (elev >= -2 && elev <= 12) crepuscular += 30; else if (elev > 12 && elev <= 20) crepuscular += 10;
        if (cl >= 15 && cl <= 55)     crepuscular += 25; else if (cl >= 55 && cl <= 75)    crepuscular += 10;
        else if (cl < 15)             crepuscular -= 10; else if (cl > 80)                 crepuscular -= 20;
        if (aod >= 0.05 && aod <= 0.3) crepuscular += 15; else if (aod > 0.3) crepuscular += 5;
        if (visK > 15) crepuscular += 10; else if (visK < 5) crepuscular -= 10;
        if (cap > 300) crepuscular += 5;
        if (azimuthRisk !== null && azimuthRisk < 35) crepuscular += 5;
        crepuscular = clamp(crepuscular);
      }

      // ── FINAL SCORE ───────────────────────────────────────────────────
      let score: number;
      if (isNight) {
        score = Math.round(astro * 0.75 + mist * 0.15 + drama * 0.10);
      } else if (isGoldAm || isBlueAm) {
        score = Math.round(drama * 0.30 + clarity * 0.40 + mist * 0.30);
      } else if (isGoldPm || isBluePm) {
        score = Math.round(drama * 0.55 + clarity * 0.30 + mist * 0.15);
      } else {
        const [a, b, c] = [drama, clarity, mist].sort((x, y) => y - x);
        score = Math.round(a * 0.55 + b * 0.35 + c * 0.10);
      }
      score = clamp(score);

      const tags: string[] = [];
      if (isGolden && clarity > 45)  tags.push('landscape');
      if (isGolden && drama > 50)    tags.push('golden hour');
      if (isBlue)                    tags.push('blue hour');
      if (mist > 40)                 tags.push('atmospheric');
      if (isNight && astro > 35)     tags.push('astrophotography');
      if (prev > 0.5 && pr < 0.1)    tags.push('reflections');
      if (crepuscular > 45)          tags.push('crepuscular rays');
      if ((azimuthRisk ?? 100) < 25 && (isGolden || isBlue)) tags.push('clear light path');
      if (!tags.length)              tags.push(score > 40 ? 'general' : 'poor');

      featureInputsByTs[ts] = {
        hourLabel: t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone }),
        overallScore: score,
        dramaScore: drama,
        clarityScore: clarity,
        mistScore: mist,
        astroScore: astro,
        crepuscularScore: crepuscular,
        cloudLowPct: cl,
        cloudMidPct: cm,
        cloudHighPct: ch,
        cloudTotalPct: ct,
        visibilityKm: Math.round(visK * 10) / 10,
        aerosolOpticalDepth: Math.round(aod * 100) / 100,
        precipProbabilityPct: pp,
        humidityPct: hum,
        temperatureC: Math.round(tmp * 10) / 10,
        dewPointC: Math.round(dew * 10) / 10,
        windKph: Math.round(spd),
        gustKph: Math.round(gst),
        windDirectionDeg: wdir != null ? Math.round(wdir) : null,
        moonIlluminationPct: Math.round(moon * 100),
        moonAltitudeDeg: Math.round(moonMetrics.altitudeDeg * 10) / 10,
        solarAltitudeDeg: Math.round(solarAltDeg * 10) / 10,
        isNight,
        isGolden,
        isBlue,
        tags,
        azimuthOcclusionRiskPct: azimuthRisk !== null ? Math.round(azimuthRisk) : null,
        azimuthLowCloudRiskPct: azimuthLowRisk !== null ? Math.round(azimuthLowRisk) : null,
        clearPathBonusPts: azimuthScan?.clearPathBonus ?? null,
        boundaryLayerHeightM: blh != null ? Math.round(blh) : null,
        horizonGapPct: horizonGapPct !== null ? Math.round(horizonGapPct) : null,
        capeJkg: Math.round(cap),
        ensembleCloudStdDevPct: ensIdx[ts] ? Math.round(ensIdx[ts]!.stdDev) : null,
        ensembleCloudMeanPct: ensIdx[ts] ? Math.round(ensIdx[ts]!.mean) : null,
      };

      hours.push({
        ts, t: t.toISOString(),
        hour: t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone }),
        score, drama, clarity, mist, astro, crepuscular, shQ,
        cl, cm, ch, ct,
        visK: Math.round(visK * 10) / 10,
        aod: Math.round(aod * 100) / 100,
        tpw: Math.round(tpw),
        wind: Math.round(spd), windDir: wdir != null ? Math.round(wdir) : null, gusts: Math.round(gst),
        tmp: Math.round(tmp * 10) / 10, hum, dew: Math.round(dew * 10) / 10,
        pp, pr, vpd,
        boundaryLayerHeightM: blh != null ? Math.round(blh) : null,
        horizonGapPct: horizonGapPct !== null ? Math.round(horizonGapPct) : null,
        azimuthRisk: azimuthRisk !== null ? Math.round(azimuthRisk) : null,
        isGolden, isGoldAm, isGoldPm, isBlue, isBlueAm, isBluePm, isNight,
        moon: Math.round(moon * 100), moonAltDeg: Math.round(moonMetrics.altitudeDeg * 10) / 10,
        solarAltDeg: Math.round(solarAltDeg * 10) / 10, uv, tags,
      });
    });

    // Best photo score — apply duration bonus at the day level
    const goldenHours = hours.filter(h => h.isGolden || h.isBlue);
    const photoHours  = goldenHours.length ? goldenHours : hours.filter(h => !h.isNight);
    const bestPhotoRaw = photoHours.reduce((b, h) => h.score > b ? h.score : b, 0);
    const bestPhoto    = Math.min(100, bestPhotoRaw + durationBonus);
    const bestPhotoH   = photoHours.reduce((b, h) => h.score > b.score ? h : b, { score: -1, hour: '\u2014', tags: [] as string[] });

    // Sub-scores per session
    const amHours = hours.filter(h => h.isGoldAm || h.isBlueAm);
    const amScore = amHours.length ? Math.min(100, Math.max(...amHours.map(h => h.score)) + Math.round(durationBonus / 2)) : 0;
    const bestAmH = amHours.length ? amHours.reduce((b, h) => h.score > b.score ? h : b) : { hour: '\u2014' };

    const pmHours = hours.filter(h => h.isGoldPm || h.isBluePm);
    const pmScore = pmHours.length ? Math.min(100, Math.max(...pmHours.map(h => h.score)) + Math.round(durationBonus / 2)) : 0;
    const bestPmH = pmHours.length ? pmHours.reduce((b, h) => h.score > b.score ? h : b) : { hour: '\u2014' };

    const nightHoursArr = hours.filter(h => h.isNight);
    const bestNightH = nightHoursArr.length
      ? nightHoursArr.reduce((best, hour) => hour.astro > best.astro ? hour : best)
      : null;
    const bestNightFinalH = nightHoursArr.length
      ? nightHoursArr.reduce((best, hour) => hour.score > best.score ? hour : best)
      : null;
    const astroScore = bestNightH?.astro ?? 0;
    const headlineScore = Math.max(bestPhotoRaw, bestNightFinalH?.score ?? 0);
    const sunriseOcclusionRisk = avg(amHours.map(h => h.azimuthRisk).filter((v): v is number => v !== null));
    const sunsetOcclusionRisk  = avg(pmHours.map(h => h.azimuthRisk).filter((v): v is number => v !== null));

    const labels    = ['Today', 'Tomorrow'];
    const labelDate = new Date(dateKey + 'T12:00:00Z');
    const dayLabel  = dayIdx < 2 ? labels[dayIdx]
      : labelDate.toLocaleDateString('en-GB', { weekday: 'long', timeZone: timezone });

    let photoEmoji: string, photoRating: string;
    if (headlineScore >= 75)      { photoEmoji = '\uD83D\uDD25'; photoRating = 'Excellent'; }
    else if (headlineScore >= 58) { photoEmoji = '\u2705'; photoRating = 'Good'; }
    else if (headlineScore >= 42) { photoEmoji = '\uD83D\uDFE1'; photoRating = 'Marginal'; }
    else                      { photoEmoji = '\u274C'; photoRating = "Poor \u2014 don't bother"; }

    // Car wash
    const dayH = hours.filter(h => !h.isNight);
    let cw: CarWash = { score: 0, rating: '\u274C', label: 'No good window', start: '\u2014', end: '\u2014', wind: 0, pp: 0, tmp: 0 };
    for (let j = 0; j <= dayH.length - 3; j++) {
      const sl = dayH.slice(j, j + 3);
      const avgWind = sl.reduce((s, h) => s + h.wind, 0) / sl.length;
      const maxPP   = Math.max(...sl.map(h => h.pp));
      const avgTmp  = sl.reduce((s, h) => s + h.tmp,  0) / sl.length;
      let sc = 100;
      if (avgWind > 25) sc -= 40; else if (avgWind > 15) sc -= 20; else if (avgWind > 10) sc -= 5;
      if (maxPP > 60)   sc -= 50; else if (maxPP > 30)   sc -= 25; else if (maxPP > 10)   sc -= 10;
      if (avgTmp < 5)   sc -= 20; else if (avgTmp > 25)  sc -= 10;
      sc = clamp(sc);
      if (sc > cw.score) cw = {
        score: sc, rating: sc >= 75 ? '\u2705' : sc >= 50 ? '\uD83D\uDFE1' : '\uD83D\uDD34',
        label: sc >= 75 ? 'Great' : sc >= 50 ? 'OK' : 'Poor',
        start: sl[0].hour, end: sl[sl.length - 1].hour,
        wind: Math.round(avgWind), pp: maxPP, tmp: Math.round(avgTmp),
      };
    }

    return {
      dateKey, dayLabel, dayIdx, hours,
      photoScore: bestPhoto, headlineScore, photoEmoji, photoRating,
      bestPhotoHour: bestPhotoH.hour || '\u2014',
      bestTags: (bestPhotoH.tags || []).slice(0, 2).join(', '),
      carWash: cw,
      sunrise: w.daily!.sunrise[dayIdx],
      sunset:  w.daily!.sunset[dayIdx],
      shSunsetQuality:  shSunset  ? Math.round((shSunset.quality  || 0) * 100) : null,
      shSunriseQuality: shSunrise ? Math.round((shSunrise.quality || 0) * 100) : null,
      shSunsetText: shSunset?.quality_text || null,
      sunDirection,
      crepRayPeak: Math.max(...hours.map(h => h.crepuscular || 0)),
      confidence, confidenceStdDev, durationBonus,
      amConfidence: amConf.confidence, amConfidenceStdDev: amConf.confidenceStdDev,
      pmConfidence: pmConf.confidence, pmConfidenceStdDev: pmConf.confidenceStdDev,
      astroConfidence: astroConf.confidence, astroConfidenceStdDev: astroConf.confidenceStdDev,
      goldAmMins: Math.round(goldAmMins), goldPmMins: Math.round(goldPmMins),
      amScore, pmScore, astroScore, bestAstroHour: bestNightH?.hour || null, darkSkyStartsAt, bestAmHour: bestAmH.hour || '\u2014', bestPmHour: bestPmH.hour || '\u2014',
      sunriseOcclusionRisk: sunriseOcclusionRisk !== null ? Math.round(sunriseOcclusionRisk) : null,
      sunsetOcclusionRisk: sunsetOcclusionRisk !== null ? Math.round(sunsetOcclusionRisk) : null,
    };
  }

  // ── METAR ────────────────────────────────────────────────────────────────

  let metarNote = '';
  try {
    const metarArr = Array.isArray(input.metarRaw) ? input.metarRaw : [];
    const raw = (metarArr[0]?.rawOb ?? '') || '';
    if (/OVC0[0-2]\d/.test(raw))    metarNote = '\u26A0\uFE0F METAR: low overcast \u2014 model may be optimistic';
    else if (/BKN0[01]\d/.test(raw)) metarNote = '\u26A0\uFE0F METAR: broken low cloud';
    else if (/CAVOK|SKC|NSC/.test(raw)) metarNote = '\u2705 METAR: clear skies confirmed';
    else if (/FEW|SCT/.test(raw))    metarNote = '\u2705 METAR: partial cloud \u2014 horizon likely clear';
    else if (raw)                    metarNote = 'METAR: ' + raw.substring(0, 60);
  } catch (_e) { /* ignore */ }

  // ── Build output ─────────────────────────────────────────────────────────

  const dailySummary: DaySummary[] = [];
  let todayHours: ScoredHour[] = [];

  sortedDates.forEach((dateKey, idx) => {
    if (idx >= 5) return;
    const day = scoreDay(dateKey, idx);
    dailySummary.push(day);
    if (dateKey === todayKey) todayHours = day.hours;
  });

  const todayDay = dailySummary.find(day => day.dateKey === todayKey) || dailySummary[0];
  const debugContext = emptyDebugContext();
  upsertDebugPayloadSnapshot(debugContext, {
    label: 'Score input payload',
    ...serializeDebugPayload(input),
  });

  if (todayDay) {
    debugContext.scores = {
      am: todayDay.amScore,
      pm: todayDay.pmScore,
      astro: todayDay.astroScore,
      overall: todayDay.headlineScore ?? todayDay.photoScore,
      certainty: debugConfidenceLabel(todayDay.confidence),
      certaintySpread: todayDay.confidenceStdDev ?? null,
      astroConfidence: debugConfidenceLabel(todayDay.astroConfidence),
      astroConfidenceStdDev: todayDay.astroConfidenceStdDev ?? null,
    };
  }

  const todayFeatures = todayHours.map(hour => {
    const fallback = toFeatureInputFromScoredHour(hour, ensIdx[hour.ts] || null);
    const captured = featureInputsByTs[hour.ts];
    return deriveHourFeatures(captured ? { ...fallback, ...captured } : fallback);
  });

  debugContext.hourlyScoring = todayHours.map((hour, index) => {
      const moonMetrics = getMoonMetrics(Date.parse(hour.ts), LAT, LON);
      const features = todayFeatures[index]!;
      const sessionScores = evaluateBuiltInSessions(features).map(score => ({
        session: score.session,
        score: score.score,
        hardPass: score.hardPass,
        confidence: score.confidence,
        volatility: score.volatility,
        reasons: score.reasons,
        warnings: score.warnings,
      }));
      return {
        hour: hour.hour,
        timestamp: hour.ts,
        final: hour.score,
        cloud: hour.ct,
        visK: hour.visK,
        aod: hour.aod,
        moonAdjustment: moonScoreAdjustment(moonMetrics),
        moonState: moonState(moonMetrics),
        aodPenalty: astroAodPenalty(hour.aod),
        astroScore: hour.astro,
        drama: hour.drama,
        clarity: hour.clarity,
        mist: hour.mist,
        moon: {
          altitudeDeg: Math.round(moonMetrics.altitudeDeg * 10) / 10,
          illuminationPct: Math.round(moonMetrics.illumination * 100),
          azimuthDeg: moonMetrics.isUp ? Math.round(moonMetrics.azimuthDeg) : null,
          isUp: moonMetrics.isUp,
        },
        sessionScores,
        tags: hour.tags,
      };
    });

  const sessionRecommendation = summarizeSessionRecommendations(todayFeatures);
  const bestSession = sessionRecommendation.primary;
  if (debugContext.scores && bestSession) {
    debugContext.scores.bestSession = {
      session: bestSession.session,
      hour: bestSession.hourLabel,
      score: bestSession.score,
      confidence: bestSession.confidence,
      volatility: bestSession.volatility,
    };
  }

  return { todayHours, dailySummary, metarNote, sessionRecommendation, debugContext };
}
