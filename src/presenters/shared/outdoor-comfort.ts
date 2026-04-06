/**
 * Outdoor Comfort Scoring
 *
 * Pure functions for scoring outdoor conditions based on weather metrics.
 * These are the "tuning seams" for outdoor comfort algorithm adjustments.
 *
 * Input: weather metrics (temp, rain probability, wind, visibility, precipitation)
 * Output: comfort score (0-100), labels, and reason codes
 *
 * This module was moved from ../email/outdoor-comfort.ts to enable
 * sharing across multiple presenters (email, site, etc.).
 */

import { C } from './brief-primitives.js';
import type { NextDayHour } from '../../contracts/index.js';

/**
 * Configuration for outdoor comfort scoring thresholds.
 * Extracted as a config object for easy tuning.
 */
export const COMFORT_SCORE_CONFIG = {
  rain: {
    heavy: { threshold: 70, penalty: 50 },
    moderate: { threshold: 40, penalty: 30 },
    light: { threshold: 20, penalty: 15 },
    minimal: { threshold: 5, penalty: 5 },
  },
  wind: {
    extreme: { threshold: 45, penalty: 45 },
    strong: { threshold: 30, penalty: 30 },
    moderate: { threshold: 20, penalty: 15 },
    light: { threshold: 12, penalty: 5 },
  },
  temperature: {
    freezing: { threshold: 0, penalty: 35 },
    cold: { threshold: 4, penalty: 20 },
    cool: { threshold: 7, penalty: 10 },
    hot: { threshold: 32, penalty: 15 },
    veryHot: { threshold: 27, penalty: 5 },
  },
  visibility: {
    veryPoor: { threshold: 0.5, penalty: 40 },
    poor: { threshold: 2, penalty: 25 },
    reduced: { threshold: 5, penalty: 10 },
  },
  precipitation: {
    heavy: { threshold: 3, penalty: 30 },
    moderate: { threshold: 1, penalty: 20 },
    light: { threshold: 0.2, penalty: 10 },
  },
} as const;

/**
 * Run-friendly weather thresholds.
 * Used by outdoorComfortLabel to determine if conditions are suitable for running.
 */
export const RUN_FRIENDLY_THRESHOLDS = {
  maxWindKmh: 22,
  minTempC: 4,
  maxTempC: 25,
  maxRainPct: 40,
} as const;

/**
 * Calculate outdoor comfort score from weather metrics.
 *
 * @param h - Weather metrics (temp, rain probability, wind, visibility, precipitation)
 * @returns Comfort score from 0-100
 */
export function outdoorComfortScore(
  h: Pick<NextDayHour, 'tmp' | 'pp' | 'wind' | 'visK' | 'pr'>,
): number {
  let score = 100;
  const cfg = COMFORT_SCORE_CONFIG;

  // Rain probability penalties
  if (h.pp > cfg.rain.heavy.threshold) score -= cfg.rain.heavy.penalty;
  else if (h.pp > cfg.rain.moderate.threshold) score -= cfg.rain.moderate.penalty;
  else if (h.pp > cfg.rain.light.threshold) score -= cfg.rain.light.penalty;
  else if (h.pp > cfg.rain.minimal.threshold) score -= cfg.rain.minimal.penalty;

  // Wind penalties
  if (h.wind > cfg.wind.extreme.threshold) score -= cfg.wind.extreme.penalty;
  else if (h.wind > cfg.wind.strong.threshold) score -= cfg.wind.strong.penalty;
  else if (h.wind > cfg.wind.moderate.threshold) score -= cfg.wind.moderate.penalty;
  else if (h.wind > cfg.wind.light.threshold) score -= cfg.wind.light.penalty;

  // Temperature penalties
  if (h.tmp < cfg.temperature.freezing.threshold) score -= cfg.temperature.freezing.penalty;
  else if (h.tmp < cfg.temperature.cold.threshold) score -= cfg.temperature.cold.penalty;
  else if (h.tmp < cfg.temperature.cool.threshold) score -= cfg.temperature.cool.penalty;
  else if (h.tmp > cfg.temperature.hot.threshold) score -= cfg.temperature.hot.penalty;
  else if (h.tmp > cfg.temperature.veryHot.threshold) score -= cfg.temperature.veryHot.penalty;

  // Visibility penalties
  if (h.visK < cfg.visibility.veryPoor.threshold) score -= cfg.visibility.veryPoor.penalty;
  else if (h.visK < cfg.visibility.poor.threshold) score -= cfg.visibility.poor.penalty;
  else if (h.visK < cfg.visibility.reduced.threshold) score -= cfg.visibility.reduced.penalty;

  // Precipitation penalties
  if (h.pr > cfg.precipitation.heavy.threshold) score -= cfg.precipitation.heavy.penalty;
  else if (h.pr > cfg.precipitation.moderate.threshold) score -= cfg.precipitation.moderate.penalty;
  else if (h.pr > cfg.precipitation.light.threshold) score -= cfg.precipitation.light.penalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

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
 * Parse clock string "HH:MM" into minutes since midnight, or null.
 */
function clockToMinutes(hour: string | undefined): number | null {
  if (!hour) return null;
  const match = hour.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Select a time-of-day-aware comfort label for the ≥75 score band.
 * Falls back to generic text when hour is unavailable.
 */
function timeOfDayComfortText(runFriendly: boolean, hour: string | undefined): string {
  const minutes = clockToMinutes(hour);
  if (minutes === null) return runFriendly ? 'Best for a run' : 'Best for a walk';

  // After dark (21:00+)
  if (minutes >= 1260) return 'After-dark stroll';
  // Evening (18:00–20:59)
  if (minutes >= 1080) return runFriendly ? 'Evening run' : 'Evening stroll';
  // Afternoon (13:00–17:59)
  if (minutes >= 780) return runFriendly ? 'Afternoon run' : 'Afternoon walk';
  // Lunch (11:00–12:59)
  if (minutes >= 660) return runFriendly ? 'Lunch run' : 'Lunch walk';
  // Morning (06:00–10:59)
  if (minutes >= 360) return runFriendly ? 'Morning run' : 'Morning walk';
  // Pre-dawn (<06:00)
  return 'Pre-dawn stroll';
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
  const { maxWindKmh, minTempC, maxTempC, maxRainPct } = RUN_FRIENDLY_THRESHOLDS;

  if (score >= 75) {
    const runFriendly =
      h.wind <= maxWindKmh &&
      h.tmp >= minTempC &&
      h.tmp <= maxTempC &&
      h.pp < maxRainPct;
    return {
      text: timeOfDayComfortText(runFriendly, hour),
      fg: C.success,
      bg: C.successContainer,
      highlight: true,
    };
  }
  if (score >= 55) {
    return { text: 'Pleasant', fg: C.secondary, bg: C.secondaryContainer, highlight: true };
  }
  if (score >= 35) {
    return { text: 'Acceptable', fg: C.muted, bg: C.surfaceVariant, highlight: false };
  }
  return { text: 'Poor conditions', fg: C.error, bg: C.errorContainer, highlight: false };
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
