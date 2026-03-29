import { HOME_SITE_DARKNESS, type SiteDarkness } from './site-darkness.js';
import type { AltLocation } from './prepare-alt-locations.js';
import { emptyDebugContext, type DebugContext } from './debug-context.js';
import { DEFAULT_HOME_LOCATION } from '../types/home-location.js';
import { evaluateDay } from './shared-scoring.js';

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

/** A today-alt candidate that passed threshold + home comparison. */
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

/** Home-location context produced by the Best Windows stage. */
export interface HomeContext {
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
  homeContext: HomeContext;
  timezone?: string;
}

/** Output from scoreAlternatives. */
export interface ScoreAlternativesOutput {
  altLocations: TodayAlt[];
  closeContenders: TodayAlt[];
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

function scoreLoc(
  wData: AltWeatherData,
  loc: AltLocation,
  timezone: string,
): LocDayScore[] {
  const byDate: Record<string, { ts: string; i: number }[]> = {};
  (wData.hourly?.time || []).forEach((ts, i) => {
    const d = new Date(ts).toLocaleDateString('en-CA', { timeZone: timezone });
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

    // Accumulate snow data (nearby-specific — not applicable to long-range)
    let maxSnowDepthM = 0;
    let totalSnowfallCm = 0;
    let hasSnowData = false;
    for (const { i } of byDate[dateKey]) {
      const snowDepthM = wData.hourly!.snow_depth?.[i];
      const snowfallHr = wData.hourly!.snowfall?.[i];
      if (snowDepthM !== undefined || snowfallHr !== undefined) {
        hasSnowData = true;
        if (snowDepthM !== undefined) maxSnowDepthM = Math.max(maxSnowDepthM, snowDepthM);
        if (snowfallHr !== undefined) totalSnowfallCm += snowfallHr;
      }
    }

    // Use shared evaluation pipeline for the core scoring
    const eval_ = evaluateDay(wData, loc, byDate[dateKey], sunriseD, sunsetD, timezone);

    const meetsThreshold = (eval_.bestDay >= DAY_THRESHOLD)
      || (loc.siteDarkness.siteDarknessScore > HOME_SITE_DARKNESS.siteDarknessScore && eval_.bestAstro >= ASTRO_THRESHOLD);

    // snow_depth is in metres (Open-Meteo spec); convert to cm.
    // snowfall is already in cm/hr; sum gives total cm for the day.
    // Math.round(x * 10) / 10 rounds the total to one decimal place.
    const snowDepthCm = hasSnowData && maxSnowDepthM > 0 ? Math.round(maxSnowDepthM * 100) : null;
    const snowfallCm = hasSnowData && totalSnowfallCm > 0 ? Math.round(totalSnowfallCm * 10) / 10 : null;

    days.push({
      dateKey,
      dayIdx,
      bestDay: eval_.bestDay,
      bestAstro: eval_.bestAstro,
      bestScore: eval_.bestScore,
      bestDayHour: eval_.bestDayHour,
      bestAstroHour: eval_.bestAstroHour,
      bestTags: eval_.bestTags,
      amScore: eval_.amScore,
      pmScore: eval_.pmScore,
      isAstroWin: eval_.isAstroWin,
      meetsThreshold,
      snowDepthCm,
      snowfallCm,
    });
  });
  return days;
}

function toTodayAlt(loc: AltLocation, today: LocDayScore): TodayAlt {
  return {
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
  };
}

function qualifiesAsCloseContender(
  today: LocDayScore,
  loc: AltLocation,
  homeHeadline: number,
  selectedWindowPeak: number | null,
): boolean {
  if (!today.meetsThreshold || !today.isAstroWin) return false;
  if (loc.siteDarkness.bortle > 4) return false;
  if (today.bestScore < homeHeadline) return false;
  if (today.bestScore >= homeHeadline + 8) return false;
  if (selectedWindowPeak !== null && today.bestScore <= selectedWindowPeak) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                       */
/* ------------------------------------------------------------------ */

export function scoreAlternatives(input: ScoreAlternativesInput): ScoreAlternativesOutput {
  const { altWeatherData, altLocationMeta, homeContext } = input;
  const { dailySummary } = homeContext;
  const debugContext = homeContext.debugContext || emptyDebugContext();
  const homeLocationName = debugContext.metadata?.location || DEFAULT_HOME_LOCATION.name;
  const timezone = input.timezone || debugContext.metadata?.timezone || DEFAULT_HOME_LOCATION.timezone;

  // Score every location across all forecast days
  const allLocScores = altWeatherData.map((wData, idx) => {
    const loc = altLocationMeta[idx];
    if (!loc || !wData?.hourly) return null;
    const days = scoreLoc(wData, loc, timezone);
    return { loc, days };
  }).filter((x): x is { loc: AltLocation; days: LocDayScore[] } => x !== null);

  // Use the same local headline score that is shown to the user in the hero.
  const homeHeadlineFromContext = typeof homeContext.todayBestScore === 'number'
    ? homeContext.todayBestScore
    : null;
  const homeHeadline = homeHeadlineFromContext
    ?? dailySummary[0]?.headlineScore
    ?? dailySummary[0]?.photoScore
    ?? 0;

  // The selected window peak — same baseline used in AI/fallback editorial text.
  const selectedWindowPeak = debugContext.windows.find(w => w.selected)?.peak ?? null;

  // Filter today's alternatives: must meet threshold AND beat the home baseline by at least 8 pts.
  const todayAlts: TodayAlt[] = allLocScores.flatMap(({ loc, days }) => {
    const today = days[0];
    if (!today || !today.meetsThreshold) return [];
    // Only show alts that beat the home baseline by a meaningful margin (8+ pts).
    if (today.bestScore < homeHeadline + 8) return [];
    return [toTodayAlt(loc, today)];
  }).sort((a, b) => b.bestScore - a.bestScore);

  const closeContenders: TodayAlt[] = allLocScores.flatMap(({ loc, days }) => {
    const today = days[0];
    if (!today || !qualifiesAsCloseContender(today, loc, homeHeadline, selectedWindowPeak)) return [];
    return [toTodayAlt(loc, today)];
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

  const noAltsMsg = todayAlts.length === 0 && closeContenders.length === 0
    ? 'No nearby locations score well enough today to recommend a trip.'
    : null;

  debugContext.nearbyAlternatives = allLocScores
    .map(({ loc, days }) => {
      const today = days[0];
      if (!today) return null;

      const shown = today.meetsThreshold && today.bestScore >= homeHeadline + 8;
      const closeContender = qualifiesAsCloseContender(today, loc, homeHeadline, selectedWindowPeak);
      let discardedReason: string | undefined;

      if (!today.meetsThreshold) {
        if (today.isAstroWin) {
          discardedReason = `astro score below threshold (${today.bestAstro} < ${ASTRO_THRESHOLD})`;
        } else {
          discardedReason = `daylight score below threshold (${today.bestDay} < ${DAY_THRESHOLD})`;
        }
      } else if (closeContender) {
        discardedReason = 'close contender: darker-sky near miss below the main 8-point cutoff';
      } else if (!shown) {
        discardedReason = `score does not beat ${homeLocationName} by at least 8 points (${today.bestScore} vs ${homeHeadline})`;
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
        weatherDelta: today.bestScore - homeHeadline,
        deltaVsWindowPeak: selectedWindowPeak !== null ? today.bestScore - selectedWindowPeak : null,
        discardedReason,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) => b.bestScore - a.bestScore)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  return { altLocations: todayAlts, closeContenders, noAltsMsg, augmentedSummary, debugContext };
}
