import { getMoonMetrics, getSolarAltitude, moonScoreAdjustment } from './astro.js';
import { HOME_SITE_DARKNESS, astroDarknessBonus, type SiteDarkness } from './site-darkness.js';
import { clamp } from './utils.js';
import type { AltWeatherData } from './score-alternatives.js';
import type { LocationTag, Region } from './long-range-locations.js';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                        */
/* ------------------------------------------------------------------ */

export interface LongRangeMeta {
  name: string;
  lat: number;
  lon: number;
  region: Region;
  elevation: number;
  tags: LocationTag[];
  siteDarkness: SiteDarkness;
  darkSky: boolean;
  driveMins: number;
}

export interface LongRangeCandidate {
  name: string;
  region: Region;
  driveMins: number;
  tags: string[];
  siteDarkness: SiteDarkness;
  darkSky: boolean;
  elevation: number;
  dayScore: number;
  amScore: number;
  pmScore: number;
  astroScore: number;
  bestScore: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  isAstroWin: boolean;
}

export interface LongRangeDebugCandidate extends LongRangeCandidate {
  rank: number;
  deltaVsLeeds: number;
  shown: boolean;
  discardedReason?: string;
}

export interface ScoreLongRangeInput {
  longRangeWeatherData: AltWeatherData[];
  longRangeMeta: LongRangeMeta[];
  leedsHeadlineScore: number;
  isWeekday: boolean;
}

export interface DarkSkyAlert {
  name: string;
  region: Region;
  driveMins: number;
  astroScore: number;
  bestAstroHour: string | null;
}

export interface ScoreLongRangeOutput {
  /** Top long-range candidate (null if none meets threshold). */
  longRangeTop: LongRangeCandidate | null;
  /** True if the card should be shown (score >= 80 and delta >= 20). */
  showCard: boolean;
  /** Label for weekday display: "Weekend opportunity" on weekdays. */
  cardLabel: string | null;
  /** All candidates that met the minimum threshold, ranked by score. */
  longRangeCandidates: LongRangeCandidate[];
  /** Full evaluated pool for debug output, including discarded candidates and reasons. */
  longRangeDebugCandidates: LongRangeDebugCandidate[];
  /** Dark sky alert: perfect astro conditions at a known dark site. */
  darkSkyAlert: DarkSkyAlert | null;
}

const ASTRO_DARK_ELEVATION = -18;

/* ------------------------------------------------------------------ */
/*  Thresholds                                                        */
/* ------------------------------------------------------------------ */

/** Minimum score to consider a long-range trip worthwhile.
 *  The alt-location scoring algorithm (which excludes AOD/azimuth/crepuscular/SunsetHue)
 *  tops out around 55-65 in ideal conditions. 50 filters out poor/marginal days.
 *  The delta threshold ensures the location is genuinely better than Leeds. */
const LONG_RANGE_SCORE_THRESHOLD = 50;
const LONG_RANGE_DELTA_THRESHOLD = 10;
const ASTRO_DARK_SKY_THRESHOLD = 70;

/* ------------------------------------------------------------------ */
/*  Per-location scoring (today only)                                  */
/* ------------------------------------------------------------------ */

function scoreLocToday(wData: AltWeatherData, meta: LongRangeMeta): LongRangeCandidate | null {
  if (!wData?.hourly?.time?.length) return null;

  const dateKey = new Date(wData.hourly.time[0]).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const sunriseD = new Date(wData.daily?.sunrise?.[0] || dateKey + 'T06:30:00Z');
  const sunsetD = new Date(wData.daily?.sunset?.[0] || dateKey + 'T18:30:00Z');
  const goldAmS = new Date(+sunriseD - 10 * 60000);
  const goldAmE = new Date(+sunriseD + 65 * 60000);
  const goldPmS = new Date(+sunsetD - 65 * 60000);
  const goldPmE = new Date(+sunsetD + 5 * 60000);
  const blueAmS = new Date(+sunriseD - 30 * 60000);
  const bluePmE = new Date(+sunsetD + 30 * 60000);

  let bestDay = 0;
  let bestAstro = 0;
  let bestAm = 0;
  let bestPm = 0;
  let bestDayHour: string | null = null;
  let bestAstroHour: string | null = null;

  wData.hourly.time.forEach((ts, i) => {
    const t = new Date(ts);
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

    const isGoldAm = t >= goldAmS && t <= goldAmE;
    const isGoldPm = t >= goldPmS && t <= goldPmE;
    const isBlue = (t >= blueAmS && t < goldAmS) || (t > goldPmE && t <= bluePmE);
    const isGolden = isGoldAm || isGoldPm;
    const isNight = t < blueAmS || t > bluePmE;
    const isPostSunset = isGoldPm && t >= sunsetD;

    if (isGolden || isBlue) {
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

      const isAmSession = isGoldAm || (t >= blueAmS && t < goldAmS);
      let score: number;
      if (isAmSession) {
        score = clamp(Math.round(drama * 0.30 + clarity * 0.40 + mist * 0.30));
        bestAm = Math.max(bestAm, score);
      } else {
        score = clamp(Math.round(drama * 0.55 + clarity * 0.30 + mist * 0.15));
        bestPm = Math.max(bestPm, score);
      }

      if (score > bestDay) {
        bestDay = score;
        bestDayHour = t.toLocaleTimeString('en-GB', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
        });
      }
    }

    if (isNight && getSolarAltitude(+t, meta.lat, meta.lon) < ASTRO_DARK_ELEVATION) {
      const moonMetrics = getMoonMetrics(+t, meta.lat, meta.lon);
      let astro = 0;
      astro += moonScoreAdjustment(moonMetrics);
      if (ct < 10) astro += 30; else if (ct < 30) astro += 10; else if (ct > 60) astro -= 25;
      if (visK > 20) astro += 15;
      if (hum < 80) astro += 5;
      astro += astroDarknessBonus(meta.siteDarkness);
      astro = clamp(astro);
      if (astro > bestAstro) {
        bestAstro = astro;
        bestAstroHour = t.toLocaleTimeString('en-GB', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
        });
      }
    }
  });

  const isAstroWin = bestAstro > bestDay && meta.siteDarkness.siteDarknessScore > HOME_SITE_DARKNESS.siteDarknessScore;
  const bestScore = Math.max(bestDay, isAstroWin ? bestAstro : 0);

  return {
    name: meta.name,
    region: meta.region,
    driveMins: meta.driveMins,
    tags: meta.tags,
    siteDarkness: meta.siteDarkness,
    darkSky: meta.darkSky,
    elevation: meta.elevation,
    dayScore: bestDay,
    amScore: bestAm,
    pmScore: bestPm,
    astroScore: bestAstro,
    bestScore,
    bestDayHour,
    bestAstroHour,
    isAstroWin,
  };
}

/* ------------------------------------------------------------------ */
/*  Main export                                                       */
/* ------------------------------------------------------------------ */

export function scoreLongRange(input: ScoreLongRangeInput): ScoreLongRangeOutput {
  const { longRangeWeatherData, longRangeMeta, leedsHeadlineScore, isWeekday } = input;

  const rawCandidates = longRangeWeatherData
    .map((wData, idx) => scoreLocToday(wData, longRangeMeta[idx]))
    .filter((c): c is LongRangeCandidate => c !== null);

  const rankedCandidates = [...rawCandidates].sort((a, b) => b.bestScore - a.bestScore);
  const candidates = rankedCandidates.filter(c => c.bestScore >= LONG_RANGE_SCORE_THRESHOLD);

  const top = candidates[0] || null;
  const delta = top ? top.bestScore - leedsHeadlineScore : 0;
  const meetsThreshold = top !== null && delta >= LONG_RANGE_DELTA_THRESHOLD;

  const longRangeDebugCandidates = rankedCandidates.map((candidate, index) => {
    const candidateDelta = candidate.bestScore - leedsHeadlineScore;
    let shown = false;
    let discardedReason: string | undefined;

    if (candidate.bestScore < LONG_RANGE_SCORE_THRESHOLD) {
      discardedReason = `score below threshold (${candidate.bestScore} < ${LONG_RANGE_SCORE_THRESHOLD})`;
    } else if (candidateDelta < LONG_RANGE_DELTA_THRESHOLD) {
      discardedReason = `does not beat Leeds by ${LONG_RANGE_DELTA_THRESHOLD} points (${candidate.bestScore} vs ${leedsHeadlineScore})`;
    } else if (top && candidate.name === top.name && meetsThreshold) {
      shown = true;
    } else {
      discardedReason = top ? `eligible pool candidate behind ${top.name}` : 'eligible pool candidate';
    }

    return {
      ...candidate,
      rank: index + 1,
      deltaVsLeeds: candidateDelta,
      shown,
      discardedReason,
    };
  });

  // Dark sky alert: any dark-sky location with excellent astro, regardless of day score
  const darkSkyCandidates = rankedCandidates
    .filter(c => c.darkSky && c.astroScore >= ASTRO_DARK_SKY_THRESHOLD)
    .sort((a, b) => b.astroScore - a.astroScore);

  const darkSkyAlert: DarkSkyAlert | null = darkSkyCandidates[0]
    ? {
        name: darkSkyCandidates[0].name,
        region: darkSkyCandidates[0].region,
        driveMins: darkSkyCandidates[0].driveMins,
        astroScore: darkSkyCandidates[0].astroScore,
        bestAstroHour: darkSkyCandidates[0].bestAstroHour,
      }
    : null;

  return {
    longRangeTop: meetsThreshold ? top : null,
    showCard: meetsThreshold,
    cardLabel: meetsThreshold && isWeekday ? 'Weekend opportunity' : meetsThreshold ? 'Distance no object' : null,
    longRangeCandidates: candidates,
    longRangeDebugCandidates,
    darkSkyAlert,
  };
}
