/**
 * Daily summary augmentation with best alternative.
 *
 * Adds the best alternative location to each day's summary for display.
 */

import type { AltLocation } from '../prepare-alt-locations.js';
import type { LocDayScore, DaySummary, BestAltCandidate } from './types.js';

/**
 * Augment each day in the summary with its best alternative location.
 *
 * @param dailySummary - Original daily summary array
 * @param allLocScores - All scored locations with their day scores
 * @returns Augmented summary with bestAlt field
 */
export function augmentSummary(
  dailySummary: DaySummary[],
  allLocScores: { loc: AltLocation; days: LocDayScore[] }[],
): (DaySummary & { bestAlt: BestAltCandidate | null })[] {
  return dailySummary.map((day, dayIdx) => {
    const altCandidates: BestAltCandidate[] = allLocScores
      .map(({ loc, days }) => {
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
      })
      .filter((x): x is BestAltCandidate => x !== null)
      .sort((a, b) => b.bestScore - a.bestScore);

    return { ...day, bestAlt: altCandidates[0] || null };
  });
}
