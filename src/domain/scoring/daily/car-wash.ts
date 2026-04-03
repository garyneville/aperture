/**
 * Car wash scoring module.
 *
 * Finds the best 3+ hour daytime window for outdoor activities
 * (car washing, dog walking, etc.) based on wind, precipitation probability,
 * and temperature.
 */

import type { CarWash, ScoredHour } from '../contracts.js';

/**
 * Score a 3-hour sliding window for car wash suitability.
 *
 * Scoring:
 * - Wind > 25 km/h: -40, > 15: -20, > 10: -5
 * - Max precipitation probability > 60%: -50, > 30%: -25, > 10%: -10
 * - Temperature < 5°C: -20, > 25°C: -10
 */
function scoreWindow(hours: ScoredHour[]): { score: number; wind: number; pp: number; tmp: number } {
  const avgWind = hours.reduce((s, h) => s + h.wind, 0) / hours.length;
  const maxPP = Math.max(...hours.map(h => h.pp));
  const avgTmp = hours.reduce((s, h) => s + h.tmp, 0) / hours.length;

  let score = 100;
  if (avgWind > 25) score -= 40;
  else if (avgWind > 15) score -= 20;
  else if (avgWind > 10) score -= 5;

  if (maxPP > 60) score -= 50;
  else if (maxPP > 30) score -= 25;
  else if (maxPP > 10) score -= 10;

  if (avgTmp < 5) score -= 20;
  else if (avgTmp > 25) score -= 10;

  // Clamp to [0, 100]
  score = Math.min(100, Math.max(0, score));

  return { score, wind: avgWind, pp: maxPP, tmp: avgTmp };
}

/**
 * Find the best car wash window from daytime hours.
 *
 * Scans all 3-hour sliding windows during daylight hours (non-night)
 * and returns the highest scoring window.
 */
export function computeCarWash(hours: ScoredHour[]): CarWash {
  const dayHours = hours.filter(h => !h.isNight);

  // Default "no good window" result
  const defaultResult: CarWash = {
    score: 0,
    rating: '\u274C',
    label: 'No good window',
    start: '\u2014',
    end: '\u2014',
    wind: 0,
    pp: 0,
    tmp: 0,
  };

  if (dayHours.length < 3) return defaultResult;

  let best: CarWash = defaultResult;

  for (let i = 0; i <= dayHours.length - 3; i++) {
    const window = dayHours.slice(i, i + 3);
    const scored = scoreWindow(window);

    if (scored.score > best.score) {
      best = {
        score: scored.score,
        rating: scored.score >= 75 ? '\u2705' : scored.score >= 50 ? '\uD83D\uDFE1' : '\uD83D\uDD34',
        label: scored.score >= 75 ? 'Great' : scored.score >= 50 ? 'OK' : 'Poor',
        start: window[0].hour,
        end: window[window.length - 1].hour,
        wind: Math.round(scored.wind),
        pp: scored.pp,
        tmp: Math.round(scored.tmp),
      };
    }
  }

  return best;
}
