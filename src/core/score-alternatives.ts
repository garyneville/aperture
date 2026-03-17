import { getMoonMetrics, moonScoreAdjustment } from './astro.js';
import { HOME_SITE_DARKNESS, astroDarknessBonus, type SiteDarkness } from './site-darkness.js';
import { clamp } from './utils.js';
import type { AltLocation } from './prepare-alt-locations.js';
import { emptyDebugContext, type DebugContext } from './debug-context.js';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                        */
/* ------------------------------------------------------------------ */

/** Open-Meteo hourly + daily response shape (fields we use). */
export interface AltWeatherData {
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
    precipitation_probability?: number[];
    precipitation?: number[];
    windspeed_10m?: number[];
    windgusts_10m?: number[];
    total_column_integrated_water_vapour?: number[];
    /** Snowfall in cm/hr (Open-Meteo hourly, available when elevation is upland). */
    snowfall?: number[];
    /** Snow depth on the ground in metres (Open-Meteo hourly). */
    snow_depth?: number[];
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
    moonrise?: string[];
    moonset?: string[];
  };
}

/** Per-day scoring result for a single location. */
export interface LocDayScore {
  dateKey: string;
  dayIdx: number;
  bestDay: number;
  bestAstro: number;
  bestScore: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  bestTags: string[];
  amScore: number;
  pmScore: number;
  isAstroWin: boolean;
  meetsThreshold: boolean;
  /** Maximum snow depth on the ground for the day (cm), null when no data. */
  snowDepthCm: number | null;
  /** Total snowfall for the day (cm), null when no data. */
  snowfallCm: number | null;
}

/** A today-alt candidate that passed threshold + Leeds comparison. */
export interface TodayAlt {
  name: string;
  driveMins: number;
  types: string[];
  siteDarkness: SiteDarkness;
  darkSky: boolean;
  dayScore: number;
  astroScore: number;
  bestScore: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  amScore: number;
  pmScore: number;
  isAstroWin: boolean;
  meetsThreshold: boolean;
  elevationM: number;
  isUpland: boolean;
  /** Maximum snow depth on the ground for today (cm), null when no data or no snow. */
  snowDepthCm: number | null;
  /** Total snowfall for today (cm), null when no data or no snow. */
  snowfallCm: number | null;
}

/** Best alt candidate attached to each day in the augmented summary. */
export interface BestAltCandidate {
  name: string;
  driveMins: number;
  bestScore: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  isAstroWin: boolean;
  siteDarkness: SiteDarkness;
  darkSky: boolean;
  bestTags: string[];
  amScore: number;
  pmScore: number;
  elevationM: number;
  isUpland: boolean;
  snowDepthCm: number | null;
  snowfallCm: number | null;
}

/** Minimal shape for a dailySummary entry from Best Windows. */
export interface DaySummary {
  headlineScore?: number;
  photoScore?: number;
  [key: string]: unknown;
}

/** Leeds context produced by the Best Windows stage. */
export interface LeedsContext {
  windows: unknown;
  dontBother: unknown;
  todayBestScore: unknown;
  todayCarWash: unknown;
  dailySummary: DaySummary[];
  metarNote: unknown;
  sunrise: unknown;
  sunset: unknown;
  moonPct: unknown;
  debugContext?: DebugContext;
}

/** Input to scoreAlternatives. */
export interface ScoreAlternativesInput {
  altWeatherData: AltWeatherData[];
  altLocationMeta: AltLocation[];
  leedsContext: LeedsContext;
}

/** Output from scoreAlternatives. */
export interface ScoreAlternativesOutput {
  altLocations: TodayAlt[];
  noAltsMsg: string | null;
  augmentedSummary: (DaySummary & { bestAlt: BestAltCandidate | null })[];
  debugContext: DebugContext;
}

/* ------------------------------------------------------------------ */
/*  Thresholds                                                        */
/* ------------------------------------------------------------------ */

const DAY_THRESHOLD = 58;
const ASTRO_THRESHOLD = 60;

/* ------------------------------------------------------------------ */
/*  Per-location scoring                                              */
/* ------------------------------------------------------------------ */

function scoreLoc(wData: AltWeatherData, loc: AltLocation): LocDayScore[] {
  const byDate: Record<string, { ts: string; i: number }[]> = {};
  (wData.hourly?.time || []).forEach((ts, i) => {
    const d = new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push({ ts, i });
  });

  const days: LocDayScore[] = [];
  Object.keys(byDate).sort().slice(0, 5).forEach((dateKey, dayIdx) => {
    const sunriseD = new Date(
      wData.daily?.sunrise?.[dayIdx] || new Date(dateKey + 'T06:30:00Z').toISOString(),
    );
    const sunsetD = new Date(
      wData.daily?.sunset?.[dayIdx] || new Date(dateKey + 'T18:30:00Z').toISOString(),
    );
    const goldAmS = new Date(+sunriseD - 10 * 60000);
    const goldAmE = new Date(+sunriseD + 65 * 60000);
    const goldPmS = new Date(+sunsetD - 65 * 60000);
    const goldPmE = new Date(+sunsetD + 5 * 60000);
    const blueAmS = new Date(+sunriseD - 30 * 60000);
    const bluePmE = new Date(+sunsetD + 30 * 60000);
    // nightS intentionally unused in scoring loop but kept for completeness
    // const nightS = new Date(+sunsetD + 90 * 60000);

    let bestDay = 0;
    let bestAstro = 0;
    let bestDayHour: string | null = null;
    let bestAstroHour: string | null = null;
    let bestTags: string[] = [];
    let amScore = 0;
    let pmScore = 0;
    let maxSnowDepthM = 0;
    let totalSnowfallCm = 0;
    let hasSnowData = false;

    byDate[dateKey].forEach(({ ts, i }) => {
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

      // Accumulate snow data when available from Open-Meteo
      const snowDepthM = wData.hourly!.snow_depth?.[i];
      const snowfallHr = wData.hourly!.snowfall?.[i];
      if (snowDepthM !== undefined || snowfallHr !== undefined) {
        hasSnowData = true;
        if (snowDepthM !== undefined) maxSnowDepthM = Math.max(maxSnowDepthM, snowDepthM);
        if (snowfallHr !== undefined) totalSnowfallCm += snowfallHr;
      }

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

        // Session-specific weighting: AM emphasises clarity+mist, PM emphasises drama
        const isAmSession = isGoldAm || (t >= blueAmS && t < goldAmS);
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
        if (!tags.length) tags.push(score > 40 ? 'general' : 'poor');

        if (score > bestDay) {
          bestDay = score;
          bestDayHour = t.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
          });
          bestTags = tags;
        }
        if (isGoldAm || (t >= blueAmS && t < goldAmS)) amScore = Math.max(amScore, score);
        if (isGoldPm || (t > goldPmE && t <= bluePmE)) pmScore = Math.max(pmScore, score);
      }

    if (isNight) {
        const moonMetrics = getMoonMetrics(+t, loc.lat, loc.lon);
        let astro = 0;
        astro += moonScoreAdjustment(moonMetrics);
        if (ct < 10) astro += 30; else if (ct < 30) astro += 10; else if (ct > 60) astro -= 25;
        if (visK > 20) astro += 15;
        if (hum < 80) astro += 5;
        astro += astroDarknessBonus(loc.siteDarkness);
        astro = clamp(astro);
        if (astro > bestAstro) {
          bestAstro = astro;
          bestAstroHour = t.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
          });
        }
      }
    });

    const isAstroWin = bestAstro > bestDay && loc.siteDarkness.siteDarknessScore > HOME_SITE_DARKNESS.siteDarknessScore;
    const bestScore = Math.max(bestDay, isAstroWin ? bestAstro : 0);
    const meetsThreshold = (bestDay >= DAY_THRESHOLD)
      || (loc.siteDarkness.siteDarknessScore > HOME_SITE_DARKNESS.siteDarknessScore && bestAstro >= ASTRO_THRESHOLD);

    // snow_depth is in metres (Open-Meteo spec); convert to cm.
    // snowfall is already in cm/hr; sum gives total cm for the day.
    // Math.round(x * 10) / 10 rounds the total to one decimal place.
    const snowDepthCm = hasSnowData && maxSnowDepthM > 0 ? Math.round(maxSnowDepthM * 100) : null;
    const snowfallCm = hasSnowData && totalSnowfallCm > 0 ? Math.round(totalSnowfallCm * 10) / 10 : null;

    days.push({
      dateKey,
      dayIdx,
      bestDay,
      bestAstro,
      bestScore,
      bestDayHour,
      bestAstroHour,
      bestTags,
      amScore,
      pmScore,
      isAstroWin,
      meetsThreshold,
      snowDepthCm,
      snowfallCm,
    });
  });
  return days;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                       */
/* ------------------------------------------------------------------ */

export function scoreAlternatives(input: ScoreAlternativesInput): ScoreAlternativesOutput {
  const { altWeatherData, altLocationMeta, leedsContext } = input;
  const { dailySummary } = leedsContext;
  const debugContext = leedsContext.debugContext || emptyDebugContext();

  // Score every location across all forecast days
  const allLocScores = altWeatherData.map((wData, idx) => {
    const loc = altLocationMeta[idx];
    if (!loc || !wData?.hourly) return null;
    const days = scoreLoc(wData, loc);
    return { loc, days };
  }).filter((x): x is { loc: AltLocation; days: LocDayScore[] } => x !== null);

  // Today's Leeds headline score for comparison
  const leedsHeadline = dailySummary[0]?.headlineScore ?? dailySummary[0]?.photoScore ?? 0;

  // Filter today's alternatives: must meet threshold AND beat Leeds by 8+ pts
  const todayAlts: TodayAlt[] = allLocScores.flatMap(({ loc, days }) => {
    const today = days[0];
    if (!today || !today.meetsThreshold) return [];
    // Only show alts that beat Leeds by a meaningful margin (8+ pts)
    if (today.bestScore <= leedsHeadline + 8) return [];
    return [{
      name: loc.name,
      driveMins: loc.driveMins,
      types: today.bestTags?.length ? today.bestTags : loc.types,
      siteDarkness: loc.siteDarkness,
      darkSky: loc.darkSky,
      dayScore: today.bestDay,
      astroScore: today.bestAstro,
      bestScore: today.bestScore,
      bestDayHour: today.bestDayHour,
      bestAstroHour: today.bestAstroHour,
      amScore: today.amScore,
      pmScore: today.pmScore,
      isAstroWin: today.isAstroWin,
      meetsThreshold: today.meetsThreshold,
      elevationM: loc.elevationM,
      isUpland: loc.isUpland,
      snowDepthCm: today.snowDepthCm,
      snowfallCm: today.snowfallCm,
    }];
  }).sort((a, b) => b.bestScore - a.bestScore);

  // Augment each day in the summary with its best alternative location
  const augmentedSummary = dailySummary.map((day, dayIdx) => {
    const altCandidates: BestAltCandidate[] = allLocScores.map(({ loc, days }) => {
      const d = days[dayIdx];
      if (!d || !d.meetsThreshold) return null;
      return {
        name: loc.name,
        driveMins: loc.driveMins,
        bestScore: d.bestScore,
        bestDayHour: d.bestDayHour,
        bestAstroHour: d.bestAstroHour,
        isAstroWin: d.isAstroWin,
        siteDarkness: loc.siteDarkness,
        darkSky: loc.darkSky,
        bestTags: d.bestTags,
        amScore: d.amScore,
        pmScore: d.pmScore,
        elevationM: loc.elevationM,
        isUpland: loc.isUpland,
        snowDepthCm: d.snowDepthCm,
        snowfallCm: d.snowfallCm,
      };
    }).filter((x): x is BestAltCandidate => x !== null).sort((a, b) => b.bestScore - a.bestScore);

    return { ...day, bestAlt: altCandidates[0] || null };
  });

  const noAltsMsg = todayAlts.length === 0
    ? 'No nearby locations score well enough today to recommend a trip.'
    : null;

  // The selected window peak — same baseline used in AI/fallback editorial text.
  const selectedWindowPeak = debugContext.windows.find(w => w.selected)?.peak ?? null;

  debugContext.nearbyAlternatives = allLocScores
    .map(({ loc, days }) => {
      const today = days[0];
      if (!today) return null;

      const shown = today.meetsThreshold && today.bestScore > leedsHeadline + 8;
      let discardedReason: string | undefined;

      if (!today.meetsThreshold) {
        if (today.isAstroWin) {
          discardedReason = `astro score below threshold (${today.bestAstro} < ${ASTRO_THRESHOLD})`;
        } else {
          discardedReason = `daylight score below threshold (${today.bestDay} < ${DAY_THRESHOLD})`;
        }
      } else if (!shown) {
        discardedReason = `score does not beat Leeds by 8 points (${today.bestScore} vs ${leedsHeadline})`;
      }

      return {
        name: loc.name,
        rank: 0,
        shown,
        bestScore: today.bestScore,
        dayScore: today.bestDay,
        astroScore: today.bestAstro,
        driveMins: loc.driveMins,
        bortle: loc.siteDarkness.bortle,
        darknessScore: loc.siteDarkness.siteDarknessScore,
        darknessDelta: loc.siteDarkness.siteDarknessScore - HOME_SITE_DARKNESS.siteDarknessScore,
        weatherDelta: today.bestScore - leedsHeadline,
        deltaVsWindowPeak: selectedWindowPeak !== null ? today.bestScore - selectedWindowPeak : null,
        discardedReason,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) => b.bestScore - a.bestScore)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  return { altLocations: todayAlts, noAltsMsg, augmentedSummary, debugContext };
}
