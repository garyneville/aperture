import { DEFAULT_HOME_LOCATION } from '../../lib/home-location.js';
import { summarizeSessionRecommendations } from './sessions/index.js';
import { summarizeDay } from './daily/summarize-day.js';
import { buildMetarNote } from './daily/metar-note.js';
import { buildDebugContext } from './daily/build-debug-context.js';
import type { DerivedHourFeatureInput } from './features/derive-hour-features.js';
import type { SessionRecommendationSummary } from '../../types/session-score.js';
export type {
  WeatherData,
  AirQualityData,
  PrecipProbData,
  SunsetHueEntry,
  EnsembleData,
  AzimuthScanResult,
  AzimuthByPhase,
  ScoredHour,
  CarWash,
  DaySummary,
} from './contracts.js';
import type {
  WeatherData,
  AirQualityData,
  PrecipProbData,
  SunsetHueEntry,
  EnsembleData,
  AzimuthByPhase,
  ScoredHour,
  DaySummary,
} from './contracts.js';

// ── Input interface ───────────────────────────────────────────────────────────

export interface ScoreHoursInput {
  lat: number;
  lon: number;
  timezone?: string;
  weather: WeatherData;
  airQuality: AirQualityData;
  precipProb: PrecipProbData;
  metarRaw: Array<{ rawOb?: string }> | { rawOb?: string } | string;
  sunsetHue: SunsetHueEntry[] | SunsetHueEntry;
  ensemble: EnsembleData;
  azimuthByPhase: AzimuthByPhase;
}

// ── Output interface ──────────────────────────────────────────────────────────

export interface ScoreHoursOutput {
  todayHours: ScoredHour[];
  dailySummary: DaySummary[];
  metarNote: string;
  sessionRecommendation: SessionRecommendationSummary;
  debugContext: import('../../lib/debug-context.js').DebugContext;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface DateEntry { ts: string; i: number }
interface EnsEntry  { mean: number; stdDev: number }

/**
 * scoreAllDays — pure extraction of the n8n "Score Hours" node logic.
 *
 * @param input  All raw API data needed for scoring.
 * @param now    The current date (defaults to new Date(); pass explicitly for tests).
 */
export function scoreAllDays(input: ScoreHoursInput, now?: Date): ScoreHoursOutput {
  const { lat: LAT, lon: LON, weather: w, airQuality: aq, precipProb: ppData, ensemble: ensData, azimuthByPhase: azimuthByPhaseRaw } = input;
  const azimuthByPhase = azimuthByPhaseRaw || {};
  const timezone = input.timezone || DEFAULT_HOME_LOCATION.timezone;

  // SunsetHue lookup
  const shByDay: Record<string, SunsetHueEntry> = {};
  const shArr = Array.isArray(input.sunsetHue) ? input.sunsetHue : [];
  shArr.forEach(e => {
    if (!e.time) return;
    shByDay[`${e.time.substring(0, 10)}_${e.type}`] = e;
  });

  // AQ lookup
  const aqIdx: Record<string, number> = {};
  (aq.hourly?.time || []).forEach((t, i) => { aqIdx[t] = i; });

  // Precip prob lookup
  const ppIdx: Record<string, number> = {};
  (ppData.hourly?.time || []).forEach((t, i) => { ppIdx[t] = i; });

  // Ensemble: compute stdDev of cloudcover across members per timestamp
  const ensIdx: Record<string, EnsEntry> = {};
  const ensMemberKeys = Object.keys(ensData?.hourly || {}).filter(k => k.startsWith('cloudcover_member'));
  (ensData?.hourly?.time as string[] || []).forEach((ts: string, i: number) => {
    if (!ensMemberKeys.length) return;
    const vals = ensMemberKeys
      .map(k => (ensData.hourly![k] as (number | null)[])?.[i] ?? null)
      .filter((v): v is number => v !== null);
    if (!vals.length) return;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const stdDev = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length);
    ensIdx[ts] = { mean, stdDev };
  });

  const tod = now ?? new Date();
  const todayKey = tod.toLocaleDateString('en-CA', { timeZone: timezone });
  const featureInputsByTs: Record<string, DerivedHourFeatureInput> = {};

  const byDate: Record<string, DateEntry[]> = {};
  (w.hourly?.time || []).forEach((ts, i) => {
    const k = new Date(ts).toLocaleDateString('en-CA', { timeZone: timezone });
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push({ ts, i });
  });

  const sortedDates = Object.keys(byDate).sort();

  // ── Build output ──────────────────────────────────────────────────────────

  const dailySummary: DaySummary[] = [];
  let todayHours: ScoredHour[] = [];

  sortedDates.forEach((dateKey, idx) => {
    if (idx >= 5) return;
    const day = summarizeDay({
      dateKey, dayIdx: idx,
      lat: LAT, lon: LON, timezone,
      byDate, w, ppData, aqData: aq,
      shByDay, azimuthByPhase, ensIdx, ppIdx, aqIdx,
      featureInputsByTs,
    });
    dailySummary.push(day);
    if (dateKey === todayKey) todayHours = day.hours;
  });

  const todayDay = dailySummary.find(day => day.dateKey === todayKey) || dailySummary[0];
  const metarNote = buildMetarNote(input.metarRaw);

  const { debugContext, todayFeatures } = buildDebugContext({
    scoreInput: input,
    todayDay,
    todayHours,
    ensIdx,
    lat: LAT,
    lon: LON,
    featureInputsByTs,
  });

  const sessionRecommendation = summarizeSessionRecommendations(todayFeatures);
  const bestSession = sessionRecommendation.primary;
  if (debugContext.scores && bestSession) {
    debugContext.scores.bestSession = {
      session: bestSession.session,
      hour: bestSession.hourLabel,
      score: bestSession.score,
      confidence: bestSession.confidence,
      volatility: bestSession.volatility,
    };
  }

  return { todayHours, dailySummary, metarNote, sessionRecommendation, debugContext };
}
