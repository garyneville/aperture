/**
 * Daily summary alignment.
 *
 * Aligns the daily summary metadata (bestPhotoHour, bestTags) with the
 * selected top window to ensure consistency between window selection
 * and displayed summary.
 */

import type { DailySummary, Window } from './types.js';
import { headlineTagsForWindow } from './labeling.js';

/**
 * Align today's daily summary with the selected top window.
 *
 * Updates bestPhotoHour and bestTags to reflect the actual selected window,
 * ensuring the hero card matches the window card.
 *
 * @param dailySummary - Array of daily summaries
 * @param windows - Selected windows
 * @returns Updated daily summary array
 */
export function alignTodaySummaryWithWindow(
  dailySummary: DailySummary[],
  windows: Window[],
): DailySummary[] {
  if (!dailySummary.length || !windows.length) return dailySummary;

  const [topWindow, ...restWindows] = windows;
  const topHour = topWindow.hours?.find(hour => hour.score === topWindow.peak) || topWindow.hours?.[0];
  const summaryTags = headlineTagsForWindow(topWindow);

  if (!topHour) return dailySummary;

  return [
    {
      ...dailySummary[0],
      bestPhotoHour: topHour.hour || topWindow.start,
      bestTags: summaryTags || dailySummary[0].bestTags,
    },
    ...dailySummary.slice(1),
  ];
}
