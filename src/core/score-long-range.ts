import { type SiteDarkness } from './site-darkness.js';
import type { AltWeatherData } from './score-alternatives.js';
import type { LocationTag, Region } from './long-range-locations.js';
import { DEFAULT_HOME_LOCATION } from '../types/home-location.js';
import { evaluateDay } from './shared-scoring.js';

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
  deltaVsHome: number;
  shown: boolean;
  discardedReason?: string;
}

export interface ScoreLongRangeInput {
  longRangeWeatherData: AltWeatherData[];
  longRangeMeta: LongRangeMeta[];
  homeHeadlineScore: number;
  homeLocationName?: string;
  timezone?: string;
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

/* ------------------------------------------------------------------ */
/*  Thresholds                                                        */
/* ------------------------------------------------------------------ */

/** Minimum score to consider a long-range trip worthwhile.
 *  The alt-location scoring algorithm (which excludes AOD/azimuth/crepuscular/SunsetHue)
 *  tops out around 55-65 in ideal conditions. 50 filters out poor/marginal days.
 *  The delta threshold ensures the location is genuinely better than the home baseline. */
const LONG_RANGE_SCORE_THRESHOLD = 50;
const LONG_RANGE_DELTA_THRESHOLD = 10;
const ASTRO_DARK_SKY_THRESHOLD = 70;

/* ------------------------------------------------------------------ */
/*  Per-location scoring (today only)                                  */
/* ------------------------------------------------------------------ */

function scoreLocToday(
  wData: AltWeatherData,
  meta: LongRangeMeta,
  timezone: string,
): LongRangeCandidate | null {
  if (!wData?.hourly?.time?.length) return null;

  const dateKey = new Date(wData.hourly.time[0]).toLocaleDateString('en-CA', { timeZone: timezone });
  const sunriseD = new Date(wData.daily?.sunrise?.[0] || dateKey + 'T06:30:00Z');
  const sunsetD = new Date(wData.daily?.sunset?.[0] || dateKey + 'T18:30:00Z');

  const hourIndices = wData.hourly.time.map((ts, i) => ({ ts, i }));

  // Use shared evaluation pipeline for the core scoring
  const eval_ = evaluateDay(wData, meta, hourIndices, sunriseD, sunsetD, timezone);

  return {
    name: meta.name,
    region: meta.region,
    driveMins: meta.driveMins,
    tags: meta.tags,
    siteDarkness: meta.siteDarkness,
    darkSky: meta.darkSky,
    elevation: meta.elevation,
    dayScore: eval_.bestDay,
    amScore: eval_.amScore,
    pmScore: eval_.pmScore,
    astroScore: eval_.bestAstro,
    bestScore: eval_.bestScore,
    bestDayHour: eval_.bestDayHour,
    bestAstroHour: eval_.bestAstroHour,
    isAstroWin: eval_.isAstroWin,
  };
}

/* ------------------------------------------------------------------ */
/*  Main export                                                       */
/* ------------------------------------------------------------------ */

export function scoreLongRange(input: ScoreLongRangeInput): ScoreLongRangeOutput {
  const {
    longRangeWeatherData,
    longRangeMeta,
    homeHeadlineScore,
    homeLocationName = DEFAULT_HOME_LOCATION.name,
    timezone = DEFAULT_HOME_LOCATION.timezone,
    isWeekday,
  } = input;

  const rawCandidates = longRangeWeatherData
    .map((wData, idx) => scoreLocToday(wData, longRangeMeta[idx], timezone))
    .filter((c): c is LongRangeCandidate => c !== null);

  const rankedCandidates = [...rawCandidates].sort((a, b) => b.bestScore - a.bestScore);
  const candidates = rankedCandidates.filter(c => c.bestScore >= LONG_RANGE_SCORE_THRESHOLD);

  const top = candidates[0] || null;
  const delta = top ? top.bestScore - homeHeadlineScore : 0;
  const meetsThreshold = top !== null && delta >= LONG_RANGE_DELTA_THRESHOLD;

  const longRangeDebugCandidates = rankedCandidates.map((candidate, index) => {
    const candidateDelta = candidate.bestScore - homeHeadlineScore;
    let shown = false;
    let discardedReason: string | undefined;

    if (candidate.bestScore < LONG_RANGE_SCORE_THRESHOLD) {
      discardedReason = `score below threshold (${candidate.bestScore} < ${LONG_RANGE_SCORE_THRESHOLD})`;
    } else if (candidateDelta < LONG_RANGE_DELTA_THRESHOLD) {
      discardedReason = `does not beat ${homeLocationName} by ${LONG_RANGE_DELTA_THRESHOLD} points (${candidate.bestScore} vs ${homeHeadlineScore})`;
    } else if (top && candidate.name === top.name && meetsThreshold) {
      shown = true;
    } else {
      discardedReason = top ? `eligible pool candidate behind ${top.name}` : 'eligible pool candidate';
    }

    return {
      ...candidate,
      rank: index + 1,
      deltaVsHome: candidateDelta,
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
