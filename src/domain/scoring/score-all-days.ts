import { DEFAULT_HOME_LOCATION } from '../../lib/home-location.js';
import { summarizeSessionRecommendations } from './sessions/index.js';
import { summarizeDay } from './daily/summarize-day.js';
import { buildMetarNote } from './daily/metar-note.js';
import { buildDebugContext } from './daily/build-debug-context.js';
import { computeClearingSignal } from './nowcast/satellite-clearing.js';
import { parseMetarRaw } from './metar/parse-metar.js';
import { parseMarineData } from './marine/parse-marine.js';
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
  NowcastSatelliteData,
  NowcastSignal,
  MarineData,
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
  NowcastSatelliteData,
  MarineData,
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
  nowcastSatellite?: NowcastSatelliteData;
  marine?: MarineData;
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

  // Parse METAR into structured fields (once, up-front)
  const parsedMetar = parseMetarRaw(input.metarRaw);

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

  // Marine data lookup (empty when no marine data is provided)
  const marineIdx = parseMarineData(input.marine);

  // Precipitation accumulation lookup for recent-rainfall derivation (6h trailing window)
  const precipByTs: Record<string, number> = {};
  const weatherTimes = w.hourly?.time || [];
  const weatherPrecip = w.hourly?.precipitation || [];
  for (let i = 0; i < weatherTimes.length; i++) {
    precipByTs[weatherTimes[i]] = weatherPrecip[i] ?? 0;
  }

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
      parsedMetar,
    });
    dailySummary.push(day);
    if (dateKey === todayKey) todayHours = day.hours;
  });

  const todayDay = dailySummary.find(day => day.dateKey === todayKey) || dailySummary[0];
  const metarNote = buildMetarNote(input.metarRaw);

  // Backfill marine and hydrology fields into feature inputs
  for (const ts of Object.keys(featureInputsByTs)) {
    const fi = featureInputsByTs[ts];

    // Marine: wave height, direction, swell period
    const marine = marineIdx[ts];
    if (marine) {
      fi.waveHeightM = marine.waveHeightM;
      fi.swellDirectionDeg = marine.waveDirectionDeg;
      // Use wave_height as swell proxy when swellHeightM not already set
      if (fi.swellHeightM == null && marine.waveHeightM != null) {
        fi.swellHeightM = marine.waveHeightM;
      }
      // Use wave_period as swell period proxy when swellPeriodS not already set
      if (fi.swellPeriodS == null && marine.wavePeriodS != null) {
        fi.swellPeriodS = marine.wavePeriodS;
      }
    }

    // Hydrology: recent rainfall from trailing 6h window
    const tsMs = new Date(ts).getTime();
    let recentRainfall = 0;
    for (let h = 0; h < 6; h++) {
      const lookbackMs = tsMs - h * 3600_000;
      // Find matching weather timestamp within the same hour
      const matchTs = weatherTimes.find(wt => Math.abs(new Date(wt).getTime() - lookbackMs) < 1800_000);
      if (matchTs && precipByTs[matchTs] != null) {
        recentRainfall += precipByTs[matchTs];
      }
    }
    fi.recentRainfallMm = Math.round(recentRainfall * 10) / 10;
  }

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

  // Attach nowcast clearing signals to near-term hours (0-6h window)
  attachNowcastSignals(todayHours, input.nowcastSatellite, tod);

  return { todayHours, dailySummary, metarNote, sessionRecommendation, debugContext };
}

// ── Nowcast signal attachment ─────────────────────────────────────────────────

const NOWCAST_HORIZON_HOURS = 6;

function attachNowcastSignals(
  todayHours: ScoredHour[],
  satellite: NowcastSatelliteData | undefined,
  now: Date,
): void {
  if (!satellite) return;

  for (const hour of todayHours) {
    const hourDate = new Date(hour.ts);
    const hoursAhead = (hourDate.getTime() - now.getTime()) / (3600 * 1000);
    if (hoursAhead < -1 || hoursAhead > NOWCAST_HORIZON_HOURS) continue;

    const forecastCloudCover = hour.ct; // total cloud cover 0-100
    const signal = computeClearingSignal({ satellite, forecastCloudCover, now });
    if (signal) {
      hour.nowcastSignal = signal;
    }
  }
}
