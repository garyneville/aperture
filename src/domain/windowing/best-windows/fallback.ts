/**
 * Fallback window selection.
 *
 * Builds fallback windows when no threshold windows are found,
 * either from generic session analysis or session recommendations.
 */

import type { SessionId, SessionRecommendationSummary } from '../../../types/session-score.js';
import type { ScoredHour, WindowCandidate } from './types.js';
import { STRONG_SESSION_FALLBACK_SCORE } from './types.js';

function sameSession(a: ScoredHour | null, b: ScoredHour | null): boolean {
  if (!a || !b) return false;
  const isAm = (h: ScoredHour) => h.isGoldAm || h.isBlueAm;
  const isPm = (h: ScoredHour) => h.isGoldPm || h.isBluePm;
  if (a.isNight && b.isNight) return true;
  if (isAm(a) && isAm(b)) return true;
  if (isPm(a) && isPm(b)) return true;
  return false;
}

/**
 * Build a fallback window from the best golden/blue hour when no threshold windows exist.
 *
 * @param hrs - Array of scored hours
 * @returns Window candidate or null if no suitable fallback
 */
export function buildFallbackWindow(hrs: ScoredHour[]): WindowCandidate | null {
  const candidates = hrs.filter(h =>
    (h.isGoldAm || h.isBlueAm || h.isGoldPm || h.isBluePm) &&
    typeof h.score === 'number'
  );
  if (!candidates.length) return null;

  const best = candidates.reduce((top, h) => h.score > top.score ? h : top, { score: -1 } as ScoredHour);
  if (best.score < 36) return null;

  const sessionHours = hrs.filter(h => sameSession(h, best));
  if (!sessionHours.length) return null;

  const threshold = Math.max(36, best.score - 6);
  let bestIdx = sessionHours.findIndex(h => h.t === best.t);
  if (bestIdx < 0) bestIdx = sessionHours.findIndex(h => h.hour === best.hour);
  if (bestIdx < 0) bestIdx = 0;

  let start = bestIdx;
  let end = bestIdx;
  while (start > 0 && sessionHours[start - 1].score >= threshold) start--;
  while (end < sessionHours.length - 1 && sessionHours[end + 1].score >= threshold) end++;

  const hours = sessionHours.slice(start, end + 1);
  const tops = (best.tags && best.tags.length)
    ? best.tags
    : hours.flatMap(h => h.tags || []).slice(0, 2);

  return {
    start: hours[0].hour, st: hours[0].t,
    end: hours[hours.length - 1].hour, et: hours[hours.length - 1].t,
    peak: best.score, tops, hours, fallback: true,
    selectionSource: 'fallback',
  };
}

function sessionFallbackLabel(session: SessionId): string {
  switch (session) {
    case 'urban': return 'Best urban session';
    case 'long-exposure': return 'Best long-exposure session';
    case 'mist': return 'Best mist session';
    case 'storm': return 'Best storm session';
    case 'wildlife': return 'Best wildlife session';
    case 'waterfall': return 'Best waterfall session';
    case 'seascape': return 'Best seascape session';
    case 'street': return 'Best street session';
    case 'golden-hour': return 'Best golden-hour session';
    case 'astro': return 'Best astro session';
    default: return 'Best session';
  }
}

function sessionFallbackTag(session: SessionId): string {
  switch (session) {
    case 'long-exposure': return 'long exposure';
    case 'golden-hour': return 'golden hour';
    default: return session;
  }
}

/**
 * Build a session-specific fallback window from a strong session recommendation.
 *
 * @param hrs - Array of scored hours
 * @param sessionRecommendation - Session recommendation from scoring
 * @returns Window candidate or null if no suitable session fallback
 */
export function buildSessionFallbackWindow(
  hrs: ScoredHour[],
  sessionRecommendation?: SessionRecommendationSummary,
): WindowCandidate | null {
  const primary = sessionRecommendation?.primary;
  if (!primary) return null;
  if (primary.score < STRONG_SESSION_FALLBACK_SCORE) return null;

  const anchorIdx = hrs.findIndex(hour => hour.hour === primary.hourLabel);
  if (anchorIdx < 0) return null;

  // Expand to adjacent hours with non-trivial overall scores
  const floor = Math.max(0, primary.score - 15);
  let startIdx = anchorIdx;
  let endIdx = anchorIdx;
  while (startIdx > 0 && startIdx > anchorIdx - 2 && hrs[startIdx - 1].score > floor) startIdx--;
  while (endIdx < hrs.length - 1 && endIdx < anchorIdx + 2 && hrs[endIdx + 1].score > floor) endIdx++;

  const hours = hrs.slice(startIdx, endIdx + 1);

  return {
    start: hours[0].hour,
    st: hours[0].t,
    end: hours[hours.length - 1].hour,
    et: hours[hours.length - 1].t,
    peak: primary.score,
    tops: [sessionFallbackTag(primary.session)],
    hours,
    fallback: true,
    labelHint: sessionFallbackLabel(primary.session),
    selectionSource: 'session-fallback',
  };
}
