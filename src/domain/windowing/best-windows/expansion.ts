/**
 * Window expansion for collapsed single-hour windows.
 *
 * Expands a single-hour golden/blue hour window to include adjacent
 * hours in the same session when appropriate.
 */

import type { ScoredHour, WindowCandidate } from './types.js';

function sameSession(a: ScoredHour | null, b: ScoredHour | null): boolean {
  if (!a || !b) return false;
  const isAm = (h: ScoredHour) => h.isGoldAm || h.isBlueAm;
  const isPm = (h: ScoredHour) => h.isGoldPm || h.isBluePm;
  if (a.isNight && b.isNight) return true;
  if (isAm(a) && isAm(b)) return true;
  if (isPm(a) && isPm(b)) return true;
  return false;
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.filter(Boolean))];
}

/**
 * Expand a collapsed single-hour daylight window to include adjacent session hours.
 *
 * When a window is a single golden/blue hour, expands it to include a
 * neighboring hour in the same session if available.
 *
 * @param window - Window candidate to expand
 * @param hrs - All scored hours for context
 * @returns Expanded window candidate
 */
export function expandCollapsedDaylightWindow(
  window: WindowCandidate,
  hrs: ScoredHour[],
): WindowCandidate {
  if (window.start !== window.end || window.hours.length !== 1) return window;

  const anchor = window.hours[0];
  if (!anchor || anchor.isNight || !(anchor.isGolden || anchor.isBlue)) return window;

  const sessionHours = hrs.filter(hour => sameSession(hour, anchor));
  if (sessionHours.length < 2) return window;

  const anchorIndex = sessionHours.findIndex(hour => hour.t === anchor.t || hour.hour === anchor.hour);
  if (anchorIndex < 0) return window;

  const prefersEarlier = anchor.isGoldAm || anchor.isBlueAm;
  const primaryNeighbor = prefersEarlier ? sessionHours[anchorIndex - 1] : sessionHours[anchorIndex + 1];
  const fallbackNeighbor = prefersEarlier ? sessionHours[anchorIndex + 1] : sessionHours[anchorIndex - 1];
  const neighbor = primaryNeighbor || fallbackNeighbor;
  if (!neighbor) return window;

  const hours = [anchor, neighbor].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  return {
    ...window,
    start: hours[0].hour,
    st: hours[0].t,
    end: hours[hours.length - 1].hour,
    et: hours[hours.length - 1].t,
    hours,
    tops: uniqueTags([...(window.tops || []), ...hours.flatMap(hour => hour.tags || [])]).slice(0, 2),
  };
}
