/**
 * Outdoor Comfort Scoring — Pure Functions
 *
 * Business logic for scoring outdoor comfort conditions from weather metrics.
 * No presenter dependencies — safe for import by domain and lib layers.
 *
 * Input: weather metrics (temp, rain probability, wind, visibility, precipitation)
 * Output: comfort score (0-100) and text label
 */

// ── Weather-metric shape (structural, no external type import) ────────────────

export interface ComfortWeatherInput {
  tmp: number;
  pp: number;
  wind: number;
  visK: number;
  pr: number;
}

// ── Score configuration ───────────────────────────────────────────────────────

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

export const RUN_FRIENDLY_THRESHOLDS = {
  maxWindKmh: 22,
  minTempC: 4,
  maxTempC: 25,
  maxRainPct: 40,
} as const;

// ── Score calculation ─────────────────────────────────────────────────────────

export function outdoorComfortScore(h: ComfortWeatherInput): number {
  let score = 100;
  const cfg = COMFORT_SCORE_CONFIG;

  if (h.pp > cfg.rain.heavy.threshold) score -= cfg.rain.heavy.penalty;
  else if (h.pp > cfg.rain.moderate.threshold) score -= cfg.rain.moderate.penalty;
  else if (h.pp > cfg.rain.light.threshold) score -= cfg.rain.light.penalty;
  else if (h.pp > cfg.rain.minimal.threshold) score -= cfg.rain.minimal.penalty;

  if (h.wind > cfg.wind.extreme.threshold) score -= cfg.wind.extreme.penalty;
  else if (h.wind > cfg.wind.strong.threshold) score -= cfg.wind.strong.penalty;
  else if (h.wind > cfg.wind.moderate.threshold) score -= cfg.wind.moderate.penalty;
  else if (h.wind > cfg.wind.light.threshold) score -= cfg.wind.light.penalty;

  if (h.tmp < cfg.temperature.freezing.threshold) score -= cfg.temperature.freezing.penalty;
  else if (h.tmp < cfg.temperature.cold.threshold) score -= cfg.temperature.cold.penalty;
  else if (h.tmp < cfg.temperature.cool.threshold) score -= cfg.temperature.cool.penalty;
  else if (h.tmp > cfg.temperature.hot.threshold) score -= cfg.temperature.hot.penalty;
  else if (h.tmp > cfg.temperature.veryHot.threshold) score -= cfg.temperature.veryHot.penalty;

  if (h.visK < cfg.visibility.veryPoor.threshold) score -= cfg.visibility.veryPoor.penalty;
  else if (h.visK < cfg.visibility.poor.threshold) score -= cfg.visibility.poor.penalty;
  else if (h.visK < cfg.visibility.reduced.threshold) score -= cfg.visibility.reduced.penalty;

  if (h.pr > cfg.precipitation.heavy.threshold) score -= cfg.precipitation.heavy.penalty;
  else if (h.pr > cfg.precipitation.moderate.threshold) score -= cfg.precipitation.moderate.penalty;
  else if (h.pr > cfg.precipitation.light.threshold) score -= cfg.precipitation.light.penalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Text label (no styling) ───────────────────────────────────────────────────

function clockToMinutes(hour: string | undefined): number | null {
  if (!hour) return null;
  const match = hour.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function timeOfDayComfortText(runFriendly: boolean, hour: string | undefined): string {
  const minutes = clockToMinutes(hour);
  if (minutes === null) return runFriendly ? 'Best for a run' : 'Best for a walk';

  if (minutes >= 1260) return 'After-dark stroll';
  if (minutes >= 1080) return runFriendly ? 'Evening run' : 'Evening stroll';
  if (minutes >= 780) return runFriendly ? 'Afternoon run' : 'Afternoon walk';
  if (minutes >= 660) return runFriendly ? 'Lunch run' : 'Lunch walk';
  if (minutes >= 360) return runFriendly ? 'Morning run' : 'Morning walk';
  return 'Pre-dawn stroll';
}

/**
 * Return the comfort text label for a given score and weather conditions.
 * Pure text — no styling information.
 */
export function outdoorComfortText(
  score: number,
  h: Pick<ComfortWeatherInput, 'wind' | 'tmp' | 'pp'>,
  hour?: string,
): string {
  if (score >= 75) {
    const { maxWindKmh, minTempC, maxTempC, maxRainPct } = RUN_FRIENDLY_THRESHOLDS;
    const runFriendly =
      h.wind <= maxWindKmh &&
      h.tmp >= minTempC &&
      h.tmp <= maxTempC &&
      h.pp < maxRainPct;
    return timeOfDayComfortText(runFriendly, hour);
  }
  if (score >= 55) return 'Pleasant';
  if (score >= 35) return 'Acceptable';
  return 'Poor conditions';
}
