import { clamp } from '../../../lib/utils.js';

/**
 * Post-frontal clarity detection.
 *
 * Detects the transient window of clean, high-contrast air that often follows
 * frontal passage. Wet scavenging by rain removes aerosols and particulates,
 * producing exceptional visibility for 2–6 hours before new aerosol/humidity
 * loading rebuilds.
 *
 * Four signals are combined (all must be partially present for a non-zero score):
 *   1. Recent rain — precip accumulation > 2mm in prior 3–6h, now stopped
 *   2. Wind shift — direction change > 45° across the rain/clear boundary
 *   3. Visibility jump — visibility climbing above 25km (wet-scavenged air)
 *   4. Humidity drop — RH falling below 60% after being > 80% during rain
 */

export interface HourSlice {
  ts: string;
  precipMm: number;
  precipProbPct: number;
  visibilityKm: number;
  humidityPct: number;
  windDirectionDeg: number | null;
  aerosolOpticalDepth: number;
}

export interface PostFrontalClarityResult {
  score: number;
  recentRainMm: number;
  windShiftDeg: number | null;
  visibilityKm: number;
  humidityPct: number;
  priorHumidityPct: number;
}

const LOOKBACK_HOURS = 6;
const MIN_LOOKBACK_HOURS = 3;
const RAIN_THRESHOLD_MM = 2;
const PRECIP_PROB_CLEAR_PCT = 10;
const WIND_SHIFT_THRESHOLD_DEG = 45;
const VISIBILITY_THRESHOLD_KM = 25;
const HUMIDITY_CLEAR_PCT = 60;
const HUMIDITY_RAIN_PCT = 80;
const AOD_WASHED_THRESHOLD = 0.05;

function angularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function averageWindDirection(directions: (number | null)[]): number | null {
  const valid = directions.filter((d): d is number => d != null);
  if (valid.length === 0) return null;
  // Vector average to handle wraparound
  const sinSum = valid.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0);
  const cosSum = valid.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0);
  const avg = (Math.atan2(sinSum / valid.length, cosSum / valid.length) * 180) / Math.PI;
  return ((avg % 360) + 360) % 360;
}

/**
 * Detect post-frontal clarity for a single hour.
 *
 * @param hours  All hours for the day, in chronological order.
 * @param currentIdx  Index of the hour to evaluate.
 * @returns Clarity result with 0–100 score, or null if insufficient lookback data.
 */
export function detectPostFrontalClarity(
  hours: HourSlice[],
  currentIdx: number,
): PostFrontalClarityResult | null {
  if (currentIdx < MIN_LOOKBACK_HOURS) return null;

  const current = hours[currentIdx];

  // Current hour must not be raining
  if (current.precipProbPct > PRECIP_PROB_CLEAR_PCT) {
    return { score: 0, recentRainMm: 0, windShiftDeg: null, visibilityKm: current.visibilityKm, humidityPct: current.humidityPct, priorHumidityPct: 0 };
  }

  // Lookback window: prior 3–6 hours
  const lookbackStart = Math.max(0, currentIdx - LOOKBACK_HOURS);
  const lookbackEnd = currentIdx; // exclusive
  const priorHours = hours.slice(lookbackStart, lookbackEnd);

  if (priorHours.length < MIN_LOOKBACK_HOURS) return null;

  // ── Signal 1: Recent rain ────────────────────────────────────────────────
  const recentRainMm = priorHours.reduce((sum, h) => sum + h.precipMm, 0);
  const rainSignal = recentRainMm >= RAIN_THRESHOLD_MM
    ? clamp(Math.round(((recentRainMm - RAIN_THRESHOLD_MM) / 6) * 100), 0, 100)
    : 0;

  // Must have meaningful recent rain — this is the gating signal
  if (rainSignal === 0) {
    return { score: 0, recentRainMm, windShiftDeg: null, visibilityKm: current.visibilityKm, humidityPct: current.humidityPct, priorHumidityPct: 0 };
  }

  // ── Signal 2: Wind shift ─────────────────────────────────────────────────
  // Compare average wind direction during rain period vs current hour
  const rainHourDirs = priorHours
    .filter(h => h.precipMm > 0)
    .map(h => h.windDirectionDeg);
  const priorAvgDir = averageWindDirection(rainHourDirs);
  const windShiftDeg = (priorAvgDir != null && current.windDirectionDeg != null)
    ? angularDifference(priorAvgDir, current.windDirectionDeg)
    : null;

  const windShiftSignal = windShiftDeg != null
    ? clamp(Math.round(((windShiftDeg - 20) / (WIND_SHIFT_THRESHOLD_DEG - 20)) * 100), 0, 100)
    : 50; // neutral when wind direction unavailable

  // ── Signal 3: Visibility jump ────────────────────────────────────────────
  const visSignal = current.visibilityKm >= VISIBILITY_THRESHOLD_KM
    ? clamp(Math.round(((current.visibilityKm - 20) / 15) * 100), 0, 100)
    : clamp(Math.round(((current.visibilityKm - 10) / 15) * 60), 0, 60);

  // AOD bonus: very clean air post-washout
  const aodBonus = current.aerosolOpticalDepth <= AOD_WASHED_THRESHOLD
    ? 20
    : current.aerosolOpticalDepth <= 0.10
      ? 10
      : 0;

  const visibilitySignal = clamp(visSignal + aodBonus);

  // ── Signal 4: Humidity drop ──────────────────────────────────────────────
  const priorHumidities = priorHours.map(h => h.humidityPct);
  const maxPriorHumidity = Math.max(...priorHumidities);
  const humidityDrop = maxPriorHumidity - current.humidityPct;

  const humiditySignal = (maxPriorHumidity >= HUMIDITY_RAIN_PCT && current.humidityPct <= HUMIDITY_CLEAR_PCT)
    ? clamp(Math.round((humidityDrop / 40) * 100), 0, 100)
    : (maxPriorHumidity >= 70 && current.humidityPct <= 65)
      ? clamp(Math.round((humidityDrop / 40) * 60), 0, 60)
      : 0;

  // ── Composite score ──────────────────────────────────────────────────────
  // Rain is the gating signal (35%). Other signals modulate the score.
  // All signals should contribute for a strong detection.
  const composite = Math.round(
    (rainSignal * 0.35)
    + (windShiftSignal * 0.15)
    + (visibilitySignal * 0.30)
    + (humiditySignal * 0.20),
  );

  // Apply a minimum-signal gate: at least 2 of the 4 signals must be non-zero
  const activeSignals = [rainSignal, windShiftSignal, visibilitySignal, humiditySignal]
    .filter(s => s > 0).length;
  const gatedScore = activeSignals >= 2 ? clamp(composite) : 0;

  return {
    score: gatedScore,
    recentRainMm,
    windShiftDeg: windShiftDeg != null ? Math.round(windShiftDeg) : null,
    visibilityKm: current.visibilityKm,
    humidityPct: current.humidityPct,
    priorHumidityPct: Math.round(maxPriorHumidity),
  };
}

/**
 * Find the peak post-frontal clarity window across all hours in a day.
 */
export function findPostFrontalClarityPeak(
  hours: HourSlice[],
): { peakScore: number; windowLabel: string | null } {
  let peakScore = 0;
  let windowStart: string | null = null;
  let windowEnd: string | null = null;

  const ALERT_THRESHOLD = 30;

  for (let i = 0; i < hours.length; i++) {
    const result = detectPostFrontalClarity(hours, i);
    if (result && result.score > peakScore) {
      peakScore = result.score;
    }
    if (result && result.score >= ALERT_THRESHOLD) {
      const hourLabel = new Date(hours[i].ts).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      });
      if (!windowStart) windowStart = hourLabel;
      windowEnd = hourLabel;
    }
  }

  const windowLabel = windowStart && windowEnd
    ? windowStart === windowEnd
      ? windowStart
      : `${windowStart}–${windowEnd}`
    : null;

  return { peakScore, windowLabel };
}
