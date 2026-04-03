/**
 * Debug context projection for alternative scoring.
 *
 * Builds the nearbyAlternatives debug entries with discard reasons.
 */

import { HOME_SITE_DARKNESS } from '../../../lib/site-darkness.js';
import type { AltLocation } from '../../../lib/prepare-alt-locations.js';
import type { LocDayScore } from './types.js';
import { DAY_THRESHOLD, ASTRO_THRESHOLD, BEAT_HOME_MARGIN } from './types.js';

export interface DebugAlternative {
  name: string;
  rank: number;
  shown: boolean;
  bestScore: number;
  dayScore: number;
  astroScore: number;
  driveMins: number;
  bortle: number;
  darknessScore: number;
  darknessDelta: number;
  weatherDelta: number;
  deltaVsWindowPeak: number | null;
  discardedReason?: string;
}

/**
 * Build debug entries for all alternative locations.
 *
 * @param allLocScores - All scored locations
 * @param homeHeadline - Home location's headline score
 * @param selectedWindowPeak - Peak score of selected window (if any)
 * @param homeLocationName - Name of home location for messaging
 * @param qualifiesAsCloseContender - Function to check close contender status
 * @returns Array of debug entries sorted by rank
 */
export function buildDebugAlternatives(
  allLocScores: { loc: AltLocation; days: LocDayScore[] }[],
  homeHeadline: number,
  selectedWindowPeak: number | null,
  homeLocationName: string,
  qualifiesAsCloseContenderFn: (today: LocDayScore, loc: AltLocation) => boolean,
): DebugAlternative[] {
  return allLocScores
    .map(({ loc, days }) => {
      const today = days[0];
      if (!today) return null;

      const shown = today.meetsThreshold && today.bestScore >= homeHeadline + BEAT_HOME_MARGIN;
      const closeContender = qualifiesAsCloseContenderFn(today, loc);

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
        discardedReason = `score does not beat ${homeLocationName} by at least ${BEAT_HOME_MARGIN} points (${today.bestScore} vs ${homeHeadline})`;
      }

      return {
        name: loc.name,
        rank: 0, // Will be set after sorting
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
}
