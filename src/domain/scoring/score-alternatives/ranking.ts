/**
 * Ranking rules and close-contender qualification.
 *
 * Determines which locations qualify as today alternatives or close contenders
 * based on their scores relative to the home location and selected window.
 */

import type { AltLocation } from '../../../lib/prepare-alt-locations.js';
import type { LocDayScore, TodayAlt } from './types.js';
import { toTodayAlt } from './per-location.js';
import { BEAT_HOME_MARGIN } from './types.js';

/**
 * Determine if a location qualifies as a close contender.
 *
 * Close contenders are astro winners with darker skies that nearly beat home
 * but didn't clear the main threshold margin.
 *
 * @param today - Today's score for the location
 * @param loc - Location metadata
 * @param homeHeadline - Home location's headline score
 * @param selectedWindowPeak - Peak score of the selected window (if any)
 * @returns True if location qualifies as close contender
 */
export function qualifiesAsCloseContender(
  today: LocDayScore,
  loc: AltLocation,
  homeHeadline: number,
  selectedWindowPeak: number | null,
): boolean {
  if (!today.meetsThreshold || !today.isAstroWin) return false;
  if (loc.siteDarkness.bortle > 4) return false;
  if (today.bestScore < homeHeadline) return false;
  if (today.bestScore >= homeHeadline + BEAT_HOME_MARGIN) return false;
  if (selectedWindowPeak !== null && today.bestScore <= selectedWindowPeak) return false;
  return true;
}

/**
 * Filter and rank today alternatives.
 *
 * Only locations that meet threshold AND beat home by at least BEAT_HOME_MARGIN
 * are included. Results are sorted by bestScore descending.
 *
 * @param allLocScores - All scored locations with their day scores
 * @param homeHeadline - Home location's headline score
 * @returns Array of ranked TodayAlt candidates
 */
export function rankTodayAlternatives(
  allLocScores: { loc: AltLocation; days: LocDayScore[] }[],
  homeHeadline: number,
): TodayAlt[] {
  return allLocScores
    .flatMap(({ loc, days }) => {
      const today = days[0];
      if (!today || !today.meetsThreshold) return [];
      // Only show alts that beat the home baseline by a meaningful margin
      if (today.bestScore < homeHeadline + BEAT_HOME_MARGIN) return [];
      return [toTodayAlt(loc, today)];
    })
    .sort((a, b) => b.bestScore - a.bestScore);
}

/**
 * Filter and rank close contenders.
 *
 * Close contenders are darker-sky locations that nearly beat home but didn't
 * clear the main threshold.
 *
 * @param allLocScores - All scored locations with their day scores
 * @param homeHeadline - Home location's headline score
 * @param selectedWindowPeak - Peak score of the selected window (if any)
 * @returns Array of ranked TodayAlt close contenders
 */
export function rankCloseContenders(
  allLocScores: { loc: AltLocation; days: LocDayScore[] }[],
  homeHeadline: number,
  selectedWindowPeak: number | null,
): TodayAlt[] {
  return allLocScores
    .flatMap(({ loc, days }) => {
      const today = days[0];
      if (!today || !qualifiesAsCloseContender(today, loc, homeHeadline, selectedWindowPeak)) return [];
      return [toTodayAlt(loc, today)];
    })
    .sort((a, b) => b.bestScore - a.bestScore);
}
