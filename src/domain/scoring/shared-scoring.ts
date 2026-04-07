import { getMoonMetrics, getSolarAltitude, moonScoreAdjustment } from '../../lib/astro.js';
import { HOME_SITE_DARKNESS, astroDarknessBonus, type SiteDarkness } from '../../lib/site-darkness.js';
import { clamp } from '../../lib/utils.js';
import type { AltWeatherData } from './score-alternatives.js';

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

/** Common location fields required by the shared scoring pipeline. */
export interface ScoringLocation {
  lat: number;
  lon: number;
  siteDarkness: SiteDarkness;
}

/** Result of scoring a single day at a single location. */
export interface DayEvaluation {
  bestDay: number;
  bestAstro: number;
  bestScore: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  bestTags: string[];
  amScore: number;
  pmScore: number;
  isAstroWin: boolean;
}

/** Result of scoring an individual hour within a golden/blue window. */
export interface HourDayScore {
  drama: number;
  clarity: number;
  mist: number;
  score: number;
  isAm: boolean;
  tags: string[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const ASTRO_DARK_ELEVATION = -18;

/* ------------------------------------------------------------------ */
/*  Per-hour evaluation helpers                                        */
/* ------------------------------------------------------------------ */

/** Extract weather variables from the hourly arrays at a given index. */
export function extractHourlyWeather(wData: AltWeatherData, i: number) {
  const cl = wData.hourly!.cloudcover_low?.[i] ?? 50;
  const cm = wData.hourly!.cloudcover_mid?.[i] ?? 50;
  const ch = wData.hourly!.cloudcover_high?.[i] ?? 50;
  const ct = wData.hourly!.cloudcover?.[i] ?? 50;
  const visM = wData.hourly!.visibility?.[i] ?? 10000;
  const visK = visM / 1000;
  const pp = wData.hourly!.precipitation_probability?.[i] ?? 0;
  const pr = wData.hourly!.precipitation?.[i] ?? 0;
  const spd = wData.hourly!.windspeed_10m?.[i] ?? 0;
  const gst = wData.hourly!.windgusts_10m?.[i] ?? 0;
  const hum = wData.hourly!.relativehumidity_2m?.[i] ?? 70;
  const tmp = wData.hourly!.temperature_2m?.[i] ?? 10;
  const dew = wData.hourly!.dewpoint_2m?.[i] ?? 6;
  const tpw = wData.hourly!.total_column_integrated_water_vapour?.[i] ?? 20;
  const prev = i > 0 ? (wData.hourly!.precipitation?.[i - 1] ?? 0) : 0;
  return { cl, cm, ch, ct, visM, visK, pp, pr, spd, gst, hum, tmp, dew, tpw, prev };
}

/** Classify an hour's position relative to golden/blue/night windows. */
export function classifyHour(
  t: Date,
  sunriseD: Date,
  sunsetD: Date,
) {
  const goldAmS = new Date(+sunriseD - 10 * 60000);
  const goldAmE = new Date(+sunriseD + 65 * 60000);
  const goldPmS = new Date(+sunsetD - 65 * 60000);
  const goldPmE = new Date(+sunsetD + 5 * 60000);
  const blueAmS = new Date(+sunriseD - 30 * 60000);
  const bluePmE = new Date(+sunsetD + 30 * 60000);

  const isGoldAm = t >= goldAmS && t <= goldAmE;
  const isGoldPm = t >= goldPmS && t <= goldPmE;
  const isBlue = (t >= blueAmS && t < goldAmS) || (t > goldPmE && t <= bluePmE);
  const isGolden = isGoldAm || isGoldPm;
  const isNight = t < blueAmS || t > bluePmE;
  const isPostSunset = isGoldPm && t >= sunsetD;
  const isAmSession = isGoldAm || (t >= blueAmS && t < goldAmS);

  return { isGoldAm, isGoldPm, isBlue, isGolden, isNight, isPostSunset, isAmSession, blueAmS, bluePmE };
}

/** Score a single golden-hour / blue-hour timestamp.
 *  Returns drama, clarity, mist sub-scores, weighted score, and descriptive tags.
 */
export function scoreGoldenBlueHour(
  weather: ReturnType<typeof extractHourlyWeather>,
  hourClass: ReturnType<typeof classifyHour>,
): HourDayScore {
  const { cl, cm, ch, visM, visK, pp, pr, spd, gst, hum, tmp, dew, tpw, prev } = weather;
  const { isGolden, isPostSunset, isAmSession, isBlue } = hourClass;

  let drama = isGolden ? 30 : 18;
  if (isPostSunset) {
    if (ch >= 15 && ch <= 80) drama += 24; else if (ch > 80) drama += 10;
  } else {
    if (ch >= 20 && ch <= 70) drama += 20; else if (ch > 70) drama += 8;
  }
  if (cm >= 10 && cm <= 50) drama += 10; else if (cm > 80) drama -= 5;
  if (isPostSunset) {
    if (cl > 85) drama -= 5;
  } else {
    if (cl < 20) drama += 10; else if (cl > 70) drama -= 16;
  }
  if (prev > 0.5 && pr < 0.1) drama += 10;
  if (pr > 0.5) drama -= 20;
  drama = clamp(drama);

  let clarity = 0;
  if (visK > 30) clarity += 22; else if (visK > 15) clarity += 14; else if (visK < 3) clarity -= 15;
  if (hum < 65) clarity += 4; else if (hum > 85) clarity -= 5;
  if (tpw < 15) clarity += 5; else if (tpw > 30) clarity -= Math.round((tpw - 30) / 4);
  if (pp < 10) clarity += 6; else if (pp > 45) clarity -= 10;
  if (gst > 40) clarity -= 5;
  clarity = clamp(clarity);

  let mist = 0;
  if (visM >= 200 && visM <= 1500) mist += 30;
  else if (visM > 1500 && visM <= 4000) mist += 10;
  if ((tmp - dew) < 2) mist += 20; else if ((tmp - dew) < 4) mist += 10;
  if (spd < 6) mist += 12; else if (spd < 12) mist += 5;
  if (prev > 0.5 && pr < 0.1) mist += 10;
  mist = clamp(mist);

  let score: number;
  if (isAmSession) {
    score = clamp(Math.round(drama * 0.30 + clarity * 0.40 + mist * 0.30));
  } else {
    score = clamp(Math.round(drama * 0.55 + clarity * 0.30 + mist * 0.15));
  }

  const tags: string[] = [];
  if (clarity > 40) tags.push('landscape');
  if (drama > 50) tags.push('golden hour');
  if (mist > 40) tags.push('atmospheric');
  if (prev > 0.5 && pr < 0.1) tags.push('reflections');
  if (isBlue) tags.push('blue hour');
  if (!tags.length) tags.push(score > 35 ? 'general' : 'poor');

  return { drama, clarity, mist, score, isAm: isAmSession, tags };
}

/** Score an astro candidate hour. Returns the astro score or null if the hour doesn't qualify. */
export function scoreAstroHour(
  ct: number,
  visK: number,
  hum: number,
  t: Date,
  loc: ScoringLocation,
): number | null {
  const isNightSky = getSolarAltitude(+t, loc.lat, loc.lon) < ASTRO_DARK_ELEVATION;
  if (!isNightSky) return null;

  const moonMetrics = getMoonMetrics(+t, loc.lat, loc.lon);
  let astro = 0;
  astro += moonScoreAdjustment(moonMetrics);
  if (ct < 10) astro += 30; else if (ct < 30) astro += 10; else if (ct > 60) astro -= 25;
  if (visK > 20) astro += 15;
  if (hum < 80) astro += 5;
  astro += astroDarknessBonus(loc.siteDarkness);
  return clamp(astro);
}

/** Determine astro-win status from the best day and astro scores. */
export function resolveAstroWin(
  bestDay: number,
  bestAstro: number,
  siteDarkness: SiteDarkness,
): boolean {
  return bestAstro > bestDay && siteDarkness.siteDarknessScore > HOME_SITE_DARKNESS.siteDarknessScore;
}

/** Compute the overall best score from day score and astro-win status. */
export function resolveBestScore(bestDay: number, bestAstro: number, isAstroWin: boolean): number {
  return Math.max(bestDay, isAstroWin ? bestAstro : 0);
}

/* ------------------------------------------------------------------ */
/*  Single-day evaluation                                              */
/* ------------------------------------------------------------------ */

/** Evaluate a single day's hours for a given location.
 *  This is the shared core used by both nearby-alt and long-range scoring. */
export function evaluateDay(
  wData: AltWeatherData,
  loc: ScoringLocation,
  hourIndices: { ts: string; i: number }[],
  sunriseD: Date,
  sunsetD: Date,
  timezone: string,
): DayEvaluation {
  let bestDay = 0;
  let bestAstro = 0;
  let bestDayHour: string | null = null;
  let bestAstroHour: string | null = null;
  let bestTags: string[] = [];
  let amScore = 0;
  let pmScore = 0;

  for (const { ts, i } of hourIndices) {
    const t = new Date(ts);
    const weather = extractHourlyWeather(wData, i);
    const hourClass = classifyHour(t, sunriseD, sunsetD);

    if (hourClass.isGolden || hourClass.isBlue) {
      const result = scoreGoldenBlueHour(weather, hourClass);

      if (result.score > bestDay) {
        bestDay = result.score;
        bestDayHour = t.toLocaleTimeString('en-GB', {
          hour: '2-digit', minute: '2-digit', timeZone: timezone,
        });
        bestTags = result.tags;
      }
      if (result.isAm) amScore = Math.max(amScore, result.score);
      else pmScore = Math.max(pmScore, result.score);
    }

    if (hourClass.isNight) {
      const astroResult = scoreAstroHour(weather.ct, weather.visK, weather.hum, t, loc);
      if (astroResult !== null && astroResult > bestAstro) {
        bestAstro = astroResult;
        bestAstroHour = t.toLocaleTimeString('en-GB', {
          hour: '2-digit', minute: '2-digit', timeZone: timezone,
        });
      }
    }
  }

  const isAstroWin = resolveAstroWin(bestDay, bestAstro, loc.siteDarkness);
  const bestScore = resolveBestScore(bestDay, bestAstro, isAstroWin);

  if (isAstroWin) bestTags.push('astrophotography');

  return { bestDay, bestAstro, bestScore, bestDayHour, bestAstroHour, bestTags, amScore, pmScore, isAstroWin };
}
