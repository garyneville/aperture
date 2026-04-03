import { HOME_SITE_DARKNESS } from '../../lib/site-darkness.js';
import { emptyDebugContext, type DebugContext } from '../../lib/debug-context.js';
import { DEFAULT_HOME_LOCATION } from '../../lib/home-location.js';

// Import from submodules
import type {
  AltWeatherData,
  LocDayScore,
  TodayAlt,
  BestAltCandidate,
  DaySummary,
  ScoreAlternativesInput,
  ScoreAlternativesOutput,
} from './score-alternatives/types.js';

import { scoreLocation, toTodayAlt } from './score-alternatives/per-location.js';
import { qualifiesAsCloseContender, rankTodayAlternatives, rankCloseContenders } from './score-alternatives/ranking.js';
import { augmentSummary } from './score-alternatives/augmentation.js';
import { buildDebugAlternatives } from './score-alternatives/debug.js';

// Re-export types for backward compatibility
export type {
  AltWeatherData,
  LocDayScore,
  TodayAlt,
  BestAltCandidate,
  DaySummary,
  ScoreAlternativesInput,
  ScoreAlternativesOutput,
} from './score-alternatives/types.js';

// Re-export thresholds
export { DAY_THRESHOLD, ASTRO_THRESHOLD, BEAT_HOME_MARGIN } from './score-alternatives/types.js';

/**
 * Score alternative locations and rank them against the home location.
 *
 * @param input - Scoring input with weather data and location metadata
 * @returns Scored and ranked alternatives, close contenders, and augmented summary
 */
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
    const days = scoreLocation(wData, loc, timezone);
    return { loc, days };
  }).filter((x): x is { loc: import('../../lib/prepare-alt-locations.js').AltLocation; days: LocDayScore[] } => x !== null);

  // Use the same local headline score that is shown to the user in the hero
  const homeHeadlineFromContext = typeof homeContext.todayBestScore === 'number'
    ? homeContext.todayBestScore
    : null;
  const homeHeadline = homeHeadlineFromContext
    ?? dailySummary[0]?.headlineScore
    ?? dailySummary[0]?.photoScore
    ?? 0;

  // The selected window peak - same baseline used in AI/fallback editorial text
  const selectedWindowPeak = debugContext.windows.find(w => w.selected)?.peak ?? null;

  // Build the close contender checker with captured parameters
  const closeContenderChecker = (today: LocDayScore, loc: import('../../lib/prepare-alt-locations.js').AltLocation) =>
    qualifiesAsCloseContender(today, loc, homeHeadline, selectedWindowPeak);

  // Filter and rank today's alternatives
  const todayAlts = rankTodayAlternatives(allLocScores, homeHeadline);

  // Filter and rank close contenders
  const closeContenders = rankCloseContenders(allLocScores, homeHeadline, selectedWindowPeak);

  // Augment each day in the summary with its best alternative location
  const augmentedSummary = augmentSummary(dailySummary, allLocScores);

  // Generate message when no alternatives are found
  const noAltsMsg = todayAlts.length === 0 && closeContenders.length === 0
    ? 'No nearby locations score well enough today to recommend a trip.'
    : null;

  // Build debug context
  debugContext.nearbyAlternatives = buildDebugAlternatives(
    allLocScores,
    homeHeadline,
    selectedWindowPeak,
    homeLocationName,
    closeContenderChecker,
  );

  return { altLocations: todayAlts, closeContenders, noAltsMsg, augmentedSummary, debugContext };
}
