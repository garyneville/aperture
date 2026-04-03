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

interface DateEntry { ts: string; i: number }
interface EnsEntry { mean: number; stdDev: number }

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
}

export function summarizeDay(p: SummarizeDayParams): DaySummary {
  const {
    dateKey, dayIdx, lat, lon, timezone,
    byDate, w, ppData, aqData, shByDay, azimuthByPhase, ensIdx, ppIdx, aqIdx,
    featureInputsByTs,
  } = p;

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
  void nightS; // referenced for completeness; not used in scoring
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
  const darkSkyStartTs = findDarkSkyStart(nightTimestamps, lat, lon);
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
    const tpw  = w.hourly!.total_column_integrated_water_vapour?.[i] ?? 20;
    const blh  = w.hourly!.boundary_layer_height?.[i] ?? null;

    const qi   = aqIdx[ts] ?? -1;
    const aod  = qi >= 0 ? (aqData.hourly!.aerosol_optical_depth?.[qi]  ?? 0.2) : 0.2;
    const dust = qi >= 0 ? (aqData.hourly!.dust?.[qi]                    ?? 0)   : 0;
    const aqi  = qi >= 0 ? (aqData.hourly!.european_aqi?.[qi]            ?? 25)  : 25;
    const uv   = qi >= 0 ? (aqData.hourly!.uv_index?.[qi]                ?? 0)   : 0;

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
      aod, dust, aqi, uv,
      isGolden, isGoldAm, isGoldPm, isBlue, isBlueAm, isBluePm, isNight,
      isPostSunset,
      azimuthRisk, azimuthLowRisk, azimuthScan, horizonGapPct,
      shQ,
    });

    // Backfill ensemble fields into feature input
    featureInput.ensembleCloudStdDevPct = ensIdx[ts] ? Math.round(ensIdx[ts]!.stdDev) : null;
    featureInput.ensembleCloudMeanPct   = ensIdx[ts] ? Math.round(ensIdx[ts]!.mean)   : null;

    featureInputsByTs[ts] = featureInput;
    hours.push(scoredHour);
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
    // clamp inline — avoid importing clamp for a trivial operation
    sc = Math.min(100, Math.max(0, sc));
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
    amScore, pmScore, astroScore, bestAstroHour: bestNightH?.hour || null, darkSkyStartsAt,
    bestAmHour: bestAmH.hour || '\u2014', bestPmHour: bestPmH.hour || '\u2014',
    sunriseOcclusionRisk: sunriseOcclusionRisk !== null ? Math.round(sunriseOcclusionRisk) : null,
    sunsetOcclusionRisk: sunsetOcclusionRisk !== null ? Math.round(sunsetOcclusionRisk) : null,
  };
}
