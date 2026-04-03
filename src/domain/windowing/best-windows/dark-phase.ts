/**
 * Dark phase annotation.
 *
 * Annotates astro windows with dark phase information when moonset
 * occurs within the window, marking the post-moonset darker period.
 */

import type { WindowCandidate } from './types.js';

/**
 * Annotate a window with dark phase information when applicable.
 *
 * If darkSkyStartsAt falls within the window hours, marks the dark phase
 * start and computes the post-moonset astro score.
 *
 * @param window - Window candidate to annotate
 * @param darkSkyStartsAt - Timestamp when dark sky conditions begin (moonset)
 * @returns Annotated window candidate
 */
export function annotateDarkPhase(
  window: WindowCandidate,
  darkSkyStartsAt?: string | null,
): WindowCandidate {
  if (!darkSkyStartsAt || !window.hours.length) return window;

  const splitIndex = window.hours.findIndex(hour => hour.hour === darkSkyStartsAt);
  if (splitIndex <= 0 || splitIndex >= window.hours.length) return window;

  const darkPhaseHours = window.hours.slice(splitIndex);
  const postMoonsetScore = Math.max(...darkPhaseHours.map(hour => hour.astro || 0));

  return {
    ...window,
    darkPhaseStart: darkSkyStartsAt,
    postMoonsetScore,
  };
}
