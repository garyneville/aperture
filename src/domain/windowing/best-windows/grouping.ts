/**
 * Window grouping from threshold hours.
 *
 * Groups consecutive hours that meet a score threshold into windows.
 */

import type { ScoredHour, WindowCandidate } from './types.js';

/**
 * Group consecutive hours above a threshold into windows.
 *
 * @param hrs - Array of scored hours
 * @param threshold - Minimum score to include in a window (default 45)
 * @returns Array of window candidates, sorted by peak score, limited to top 3
 */
export function groupWindows(hrs: ScoredHour[], threshold = 45): WindowCandidate[] {
  const wins: WindowCandidate[] = [];
  let cur: WindowCandidate | null = null;

  for (const h of hrs) {
    if (h.score >= threshold) {
      if (!cur) {
        cur = {
          start: h.hour, st: h.t,
          end: h.hour, et: h.t,
          peak: h.score, tops: h.tags,
          hours: [h], fallback: false,
          selectionSource: 'threshold',
        };
      } else {
        cur.end = h.hour;
        cur.et = h.t;
        cur.hours.push(h);
        if (h.score > cur.peak) {
          cur.peak = h.score;
          cur.tops = h.tags;
        }
      }
    } else if (cur) {
      wins.push(cur);
      cur = null;
    }
  }
  if (cur) wins.push(cur);
  return wins.sort((a, b) => b.peak - a.peak).slice(0, 3);
}
