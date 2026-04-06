/**
 * Outdoor Comfort Scoring — Presenter Layer
 *
 * Styled comfort labels with colors for email/site rendering.
 * Pure scoring logic is in src/lib/outdoor-comfort.ts.
 *
 * This module was moved from ../email/outdoor-comfort.ts to enable
 * sharing across multiple presenters (email, site, etc.).
 */

import { C } from './brief-primitives.js';
import type { NextDayHour } from '../../contracts/index.js';

// Re-export pure scoring functions from lib for existing consumers
export {
  COMFORT_SCORE_CONFIG,
  RUN_FRIENDLY_THRESHOLDS,
  outdoorComfortScore,
} from '../../lib/outdoor-comfort.js';

import { outdoorComfortText, RUN_FRIENDLY_THRESHOLDS } from '../../lib/outdoor-comfort.js';

/**
 * Comfort label with styling information.
 */
export interface ComfortLabel {
  text: string;
  fg: string;
  bg: string;
  highlight: boolean;
}

/**
 * Get comfort label with styling based on score and weather conditions.
 *
 * @param score - Comfort score (0-100)
 * @param h - Weather metrics for run-friendly determination
 * @param hour - Optional clock string (e.g. "14:00") for time-of-day label variation
 * @returns Label with colors and highlight flag
 */
export function outdoorComfortLabel(
  score: number,
  h: Pick<NextDayHour, 'wind' | 'tmp' | 'pp'>,
  hour?: string,
): ComfortLabel {
  const text = outdoorComfortText(score, h, hour);

  if (score >= 75) {
    return { text, fg: C.success, bg: C.successContainer, highlight: true };
  }
  if (score >= 55) {
    return { text, fg: C.secondary, bg: C.secondaryContainer, highlight: true };
  }
  if (score >= 35) {
    return { text, fg: C.muted, bg: C.surfaceVariant, highlight: false };
  }
  return { text, fg: C.error, bg: C.errorContainer, highlight: false };
}

/**
 * Reason codes for comfort scoring.
 */
export type ComfortReasonCode =
  | 'rain-heavy'
  | 'rain risk'
  | 'strong wind'
  | 'breezy'
  | 'cold'
  | 'warm'
  | 'low visibility';

/**
 * Reason thresholds for determining comfort issues.
 */
export const COMFORT_REASON_THRESHOLDS = {
  rainHeavy: { pr: 1, pp: 60 },
  rainRisk: { pr: 0.2, pp: 35 },
  strongWind: 35,
  breezy: 22,
  cold: 3,
  warm: 28,
  lowVisibility: 2,
} as const;

/**
 * Get reason codes explaining why comfort score is not perfect.
 *
 * @param h - Weather metrics
 * @returns Array of reason codes (max 2)
 */
export function outdoorComfortReasonCodes(
  h: Pick<NextDayHour, 'tmp' | 'pp' | 'wind' | 'visK' | 'pr'>,
): ComfortReasonCode[] {
  const reasons: ComfortReasonCode[] = [];
  const thresh = COMFORT_REASON_THRESHOLDS;

  if (h.pr > thresh.rainHeavy.pr || h.pp >= thresh.rainHeavy.pp) {
    reasons.push('rain-heavy');
  } else if (h.pr > thresh.rainRisk.pr || h.pp >= thresh.rainRisk.pp) {
    reasons.push('rain risk');
  }

  if (h.wind >= thresh.strongWind) {
    reasons.push('strong wind');
  } else if (h.wind >= thresh.breezy) {
    reasons.push('breezy');
  }

  if (h.tmp < thresh.cold) {
    reasons.push('cold');
  } else if (h.tmp > thresh.warm) {
    reasons.push('warm');
  }

  if (h.visK < thresh.lowVisibility) {
    reasons.push('low visibility');
  }

  return reasons.slice(0, 2);
}

/**
 * Get human-readable comfort reason string.
 *
 * @param h - Weather metrics
 * @returns Comma-separated reason string (max 2 reasons)
 */
export function outdoorComfortReason(
  h: Pick<NextDayHour, 'tmp' | 'pp' | 'wind' | 'visK' | 'pr'>,
): string {
  return outdoorComfortReasonCodes(h).join(', ');
}
