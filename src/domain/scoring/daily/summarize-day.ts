import { avg } from '../../../lib/utils.js';
import { findDarkSkyStart } from '../../../lib/astro.js';
import type {
  CarWash,
  DaySummary,
  ScoredHour,
  AzimuthScanResult,
  WeatherData,
  SunsetHueEntry,
  AzimuthByPhase,
  PrecipProbData,
  AirQualityData,
} from '../contracts.js';
import { scoreHour } from '../hourly/score-hour.js';
import type { DerivedHourFeatureInput } from '../features/derive-hour-features.js';
import { computeConfidence, type EnsEntry } from './confidence.js';
import { computeCarWash } from './car-wash.js';
import { computeTwilightBoundaries } from './twilight.js';
import type { ParsedMetar } from '../metar/parse-metar.js';
import { detectPostFrontalClarity, findPostFrontalClarityPeak, type HourSlice } from '../features/post-frontal-clarity.js';

interface DateEntry { ts: string; i: number }

export interface SummarizeDayParams {
  dateKey: string;
  dayIdx: number;
  lat: number;
  lon: number;
  timezone: string;
  byDate: Record<string, DateEntry[]>;
  w: WeatherData;
  ppData: PrecipProbData;
  aqData: AirQualityData;
  shByDay: Record<string, SunsetHueEntry>;
  azimuthByPhase: AzimuthByPhase;
  ensIdx: Record<string, EnsEntry>;
  ppIdx: Record<string, number>;
  aqIdx: Record<string, number>;
  featureInputsByTs: Record<string, DerivedHourFeatureInput>;
  parsedMetar: ParsedMetar;
}

export function summarizeDay(p: SummarizeDayParams): DaySummary {
  const {
    dateKey, dayIdx, lat, lon, timezone,
    byDate, w, ppData, aqData, shByDay, azimuthByPhase, ensIdx, ppIdx, aqIdx,
    featureInputsByTs, parsedMetar,
  } = p;

  const sunriseD = new Date(w.daily!.sunrise[dayIdx]);
  const sunsetD  = new Date(w.daily!.sunset[dayIdx]);

  // Compute twilight session boundaries and metadata
  const twilight = computeTwilightBoundaries({ dateKey, sunriseD, sunsetD, shByDay });
  const {
    goldAmS, goldAmE, goldPmS, goldPmE, blueAmS, bluePmE,
    shSunriseQ, shSunsetQ, shSunsetText, sunDirection,
    goldAmMins, goldPmMins, durationBonus,
  } = twilight;

  // Compute ensemble confidence for all sessions
  const confidenceResult = computeConfidence({
    dateKey,
    byDate,
    ensIdx,
    boundaries: { goldAmS, goldAmE, goldPmS, goldPmE, blueAmS, bluePmE },
  });

  // Night timestamps for dark sky calculation
  const nightTimestamps = (byDate[dateKey] || [])
    .map(({ ts }) => ts)
    .filter(ts => {
      const t = new Date(ts);
      return t < blueAmS || t > bluePmE;
    });
  const darkSkyStartTs = findDarkSkyStart(nightTimestamps, lat, lon);
  const darkSkyStartsAt = darkSkyStartTs
    ? new Date(darkSkyStartTs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
    : null;

  let aqNullCount = 0;

  // Score each hour
  const hours: ScoredHour[] = [];
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
    const rawLpr = ppI >= 0 ? (ppData.hourly!.lightning_potential?.[ppI] ?? null) : null;
    const pr   = w.hourly!.precipitation?.[i]   ?? 0;
    const spd  = w.hourly!.windspeed_10m?.[i]   ?? 0;
    const gst  = w.hourly!.windgusts_10m?.[i]   ?? 0;
    const wdir = w.hourly!.winddirection_10m?.[i] ?? null;
    const cap  = w.hourly!.cape?.[i]            ?? 0;
    // Apply CAPE < 500 J/kg hard floor: lightning_potential is unreliable at low CAPE
    // in UK/Northern Europe mid-latitude conditions
    const lightningRisk = rawLpr != null && cap >= 500 ? rawLpr : null;
    const vpd  = w.hourly!.vapour_pressure_deficit?.[i] ?? 0.5;
    const prev = i > 0 ? (w.hourly!.precipitation?.[i - 1] ?? 0) : 0;
    const tpw  = w.hourly!.total_column_integrated_water_vapour?.[i] ?? 20;
    const blh  = w.hourly!.boundary_layer_height?.[i] ?? null;
    const drad = w.hourly!.direct_radiation?.[i] ?? null;
    const frad = w.hourly!.diffuse_radiation?.[i] ?? null;
    const st0  = w.hourly!.soil_temperature_0cm?.[i] ?? null;

    const qi   = aqIdx[ts] ?? -1;
    const rawAod  = qi >= 0 ? (aqData.hourly!.aerosol_optical_depth?.[qi] ?? null) : null;
    const rawDust = qi >= 0 ? (aqData.hourly!.dust?.[qi]                  ?? null) : null;
    const rawAqi  = qi >= 0 ? (aqData.hourly!.european_aqi?.[qi]          ?? null) : null;
    const rawUv   = qi >= 0 ? (aqData.hourly!.uv_index?.[qi]              ?? null) : null;
    const rawPm25 = qi >= 0 ? (aqData.hourly!.pm2_5?.[qi]                ?? null) : null;
    const rawAlderPollen = qi >= 0 ? (aqData.hourly!.alder_pollen?.[qi]  ?? null) : null;
    const rawBirchPollen = qi >= 0 ? (aqData.hourly!.birch_pollen?.[qi]  ?? null) : null;
    const rawGrassPollen = qi >= 0 ? (aqData.hourly!.grass_pollen?.[qi]  ?? null) : null;

    if (qi >= 0 && (rawAod === null || rawDust === null || rawAqi === null || rawUv === null)) {
      aqNullCount++;
    }

    const aod  = rawAod  ?? 0.2;
    const dust = rawDust ?? 0;
    const aqi  = rawAqi  ?? 25;
    const uv   = rawUv   ?? 0;

    const isGoldAm = t >= goldAmS && t <= goldAmE;
    const isGoldPm = t >= goldPmS && t <= goldPmE;
    const isBlueAm = t >= blueAmS && t < goldAmS;
    const isBluePm = t > goldPmE  && t <= bluePmE;
    const isGolden = isGoldAm || isGoldPm;
    const isBlue   = isBlueAm || isBluePm;
    const isNight  = t < blueAmS || t > bluePmE;

    const isPostSunset = isGoldPm && t >= sunsetD;

    const azimuthPhase = (isGoldAm || isBlueAm) ? 'sunrise' : (isGoldPm || isBluePm) ? 'sunset' : null;
    const azimuthScan = azimuthPhase
      ? (azimuthByPhase as Record<string, Record<string, AzimuthScanResult>>)?.[azimuthPhase]?.[ts] || null
      : null;
    const azimuthRisk = azimuthScan?.occlusionRisk ?? null;
    const azimuthLowRisk = azimuthScan?.lowRisk ?? null;
    const horizonGapPct = azimuthScan?.horizonGapPct ?? null;

    const shQ = isGoldAm ? shSunriseQ : isGoldPm ? shSunsetQ : null;

    const { hour: scoredHour, featureInput } = scoreHour({
      ts, i, lat, lon, timezone,
      cl, cm, ch, ct, visK, tmp, hum, dew, pp, pr,
      spd, gst, wdir, cap, vpd, prev, tpw, blh,
      drad, frad, st0,
      aod, dust, aqi, uv,
      lightningRisk,
      isGolden, isGoldAm, isGoldPm, isBlue, isBlueAm, isBluePm, isNight,
      isPostSunset,
      azimuthRisk, azimuthLowRisk, azimuthScan, horizonGapPct,
      shQ,
      pm25: rawPm25,
      pollenMax: Math.max(rawAlderPollen ?? 0, rawBirchPollen ?? 0, rawGrassPollen ?? 0) || null,
    });

    // Backfill ensemble fields into feature input
    featureInput.ensembleCloudStdDevPct = ensIdx[ts] ? Math.round(ensIdx[ts]!.stdDev) : null;
    featureInput.ensembleCloudMeanPct   = ensIdx[ts] ? Math.round(ensIdx[ts]!.mean)   : null;

    // Backfill parsed METAR observation fields
    featureInput.metarWxType           = parsedMetar.wxType;
    featureInput.metarVisibilityM      = parsedMetar.visibilityM;
    featureInput.metarCloudBaseM       = parsedMetar.cloudBaseM;
    featureInput.metarDewPointSpreadC  = parsedMetar.dewPointSpreadC;
    // Visibility drift: observed minus forecast (positive = observed better than model)
    featureInput.visibilityDeltaVsModelKm = parsedMetar.visibilityM != null
      ? Math.round(((parsedMetar.visibilityM / 1000) - visK) * 10) / 10
      : null;

    featureInputsByTs[ts] = featureInput;
    hours.push(scoredHour);
  });

  if (aqNullCount > 0) {
    console.warn(`[Summarize Day] Coalesced null air quality values to defaults for ${aqNullCount} hours on ${dateKey}.`);
  }

  // ── Post-frontal clarity detection (multi-hour lookback) ──────────────────
  const hourSlices: HourSlice[] = (byDate[dateKey] || []).map(({ ts, i }) => ({
    ts,
    precipMm: w.hourly!.precipitation?.[i] ?? 0,
    precipProbPct: ppIdx[ts] != null && ppIdx[ts] >= 0
      ? (ppData.hourly!.precipitation_probability?.[ppIdx[ts]] ?? 0)
      : 0,
    visibilityKm: (w.hourly!.visibility?.[i] ?? 10000) / 1000,
    humidityPct: w.hourly!.relativehumidity_2m?.[i] ?? 70,
    windDirectionDeg: w.hourly!.winddirection_10m?.[i] ?? null,
    aerosolOpticalDepth: (() => {
      const qi = aqIdx[ts] ?? -1;
      return qi >= 0 ? (aqData.hourly!.aerosol_optical_depth?.[qi] ?? 0.2) : 0.2;
    })(),
  }));

  const { peakScore: postFrontalClarityPeak, windowLabel: postFrontalClarityWindow } =
    findPostFrontalClarityPeak(hourSlices);

  // Backfill post-frontal clarity scores into feature inputs
  hourSlices.forEach((slice, idx) => {
    const result = detectPostFrontalClarity(hourSlices, idx);
    const ts = slice.ts;
    if (featureInputsByTs[ts]) {
      featureInputsByTs[ts].postFrontalClarityScore = result?.score ?? null;
    }
  });

  // Best photo score - apply duration bonus at the day level
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

  // Car wash scoring
  const cw = computeCarWash(hours);

  return {
    dateKey, dayLabel, dayIdx, hours,
    photoScore: bestPhoto, headlineScore, photoEmoji, photoRating,
    bestPhotoHour: bestPhotoH.hour || '\u2014',
    bestTags: (bestPhotoH.tags || []).slice(0, 2).join(', '),
    carWash: cw,
    sunrise: w.daily!.sunrise[dayIdx],
    sunset:  w.daily!.sunset[dayIdx],
    shSunsetQuality:  shSunsetQ !== null ? Math.round(shSunsetQ * 100) : null,
    shSunriseQuality: shSunriseQ !== null ? Math.round(shSunriseQ * 100) : null,
    shSunsetText,
    sunDirection,
    crepRayPeak: Math.max(0, ...hours.map(h => h.crepuscular || 0)),
    confidence: confidenceResult.overall.confidence,
    confidenceStdDev: confidenceResult.overall.confidenceStdDev,
    durationBonus,
    amConfidence: confidenceResult.am.confidence,
    amConfidenceStdDev: confidenceResult.am.confidenceStdDev,
    pmConfidence: confidenceResult.pm.confidence,
    pmConfidenceStdDev: confidenceResult.pm.confidenceStdDev,
    astroConfidence: confidenceResult.astro.confidence,
    astroConfidenceStdDev: confidenceResult.astro.confidenceStdDev,
    goldAmMins, goldPmMins,
    amScore, pmScore, astroScore, bestAstroHour: bestNightH?.hour || null, darkSkyStartsAt,
    bestAmHour: bestAmH.hour || '\u2014', bestPmHour: bestPmH.hour || '\u2014',
    sunriseOcclusionRisk: sunriseOcclusionRisk !== null ? Math.round(sunriseOcclusionRisk) : null,
    sunsetOcclusionRisk: sunsetOcclusionRisk !== null ? Math.round(sunsetOcclusionRisk) : null,
    postFrontalClarityPeak,
    postFrontalClarityWindow,
  };
}
