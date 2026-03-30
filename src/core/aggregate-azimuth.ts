import { clamp } from './utils.js';

export interface AzimuthSampleMeta {
  type: string;
  bearing: number;
  distanceKm: number;
}

export interface AzimuthWeatherData {
  hourly?: {
    time?: string[];
    cloudcover?: number[];
    cloudcover_low?: number[];
    cloudcover_mid?: number[];
    cloudcover_high?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    visibility?: number[];
  };
}

export interface OcclusionEntry {
  avgLow: number;
  avgMid: number;
  avgHigh: number;
  avgTotal: number;
  avgPp: number;
  avgVisK: number;
  lowRisk: number;
  wetRisk: number;
  horizonGapPct: number;
  gapQualityScore: number;
  occlusionRisk: number;
  clearPathBonus: number;
  sampleCount: number;
}

export interface AggregateAzimuthOutput {
  byPhase: Record<string, Record<string, OcclusionEntry>>;
}

interface Bucket {
  weightSum: number;
  samples: number;
  low: number;
  mid: number;
  high: number;
  total: number;
  precipProb: number;
  precipRate: number;
  visK: number;
  farLowMax: number;
}

export function aggregateAzimuth(scanResults: AzimuthWeatherData[], sampleMeta: AzimuthSampleMeta[]): AggregateAzimuthOutput {
  const byPhase: Record<string, Record<string, Bucket>> = { sunrise: {}, sunset: {} };

  scanResults.forEach((data, idx) => {
    const meta = sampleMeta[idx];
    if (!meta || !data?.hourly?.time) return;

    const phase = meta.type;
    const weight = 0.8 + (meta.distanceKm / 100);
    const times = data.hourly.time || [];

    times.forEach((ts, i) => {
      if (!byPhase[phase][ts]) {
        byPhase[phase][ts] = {
          weightSum: 0, samples: 0,
          low: 0, mid: 0, high: 0, total: 0,
          precipProb: 0, precipRate: 0, visK: 0, farLowMax: 0,
        };
      }
      const bucket = byPhase[phase][ts];
      const low = data.hourly!.cloudcover_low?.[i] ?? 50;
      const mid = data.hourly!.cloudcover_mid?.[i] ?? 50;
      const high = data.hourly!.cloudcover_high?.[i] ?? 50;
      const total = data.hourly!.cloudcover?.[i] ?? 50;
      const precipProb = data.hourly!.precipitation_probability?.[i] ?? 0;
      const precipRate = data.hourly!.precipitation?.[i] ?? 0;
      const visK = (data.hourly!.visibility?.[i] ?? 10000) / 1000;

      bucket.weightSum += weight;
      bucket.samples += 1;
      bucket.low += low * weight;
      bucket.mid += mid * weight;
      bucket.high += high * weight;
      bucket.total += total * weight;
      bucket.precipProb += precipProb * weight;
      bucket.precipRate += Math.min(100, precipRate * 30) * weight;
      bucket.visK += visK * weight;
      if (meta.distanceKm >= 120) bucket.farLowMax = Math.max(bucket.farLowMax, low);
    });
  });

  const result: Record<string, Record<string, OcclusionEntry>> = { sunrise: {}, sunset: {} };

  for (const phase of Object.keys(byPhase)) {
    for (const [ts, bucket] of Object.entries(byPhase[phase])) {
      const weightSum = bucket.weightSum || 1;
      const avgLow = bucket.low / weightSum;
      const avgMid = bucket.mid / weightSum;
      const avgHigh = bucket.high / weightSum;
      const avgTotal = bucket.total / weightSum;
      const avgPp = bucket.precipProb / weightSum;
      const avgPrecip = bucket.precipRate / weightSum;
      const avgVisK = bucket.visK / weightSum;
      const lowRisk = clamp(Math.round(avgLow * 0.65 + bucket.farLowMax * 0.35));
      const wetRisk = clamp(Math.round(avgPp * 0.65 + avgPrecip * 0.35));
      const horizonGapPct = clamp(Math.round(100 - lowRisk));
      const gapDepthPct = clamp(Math.round(avgTotal - avgLow));
      const visibilitySupport = avgVisK >= 8 ? clamp(Math.round((avgVisK - 8) * 5), 0, 100) : 0;
      const gapQualityScore = clamp(Math.round(
        (horizonGapPct * 0.55)
        + (gapDepthPct * 0.20)
        + (visibilitySupport * 0.15)
        + ((100 - wetRisk) * 0.10),
      ));
      const visibilityPenalty = avgVisK < 8 ? Math.round((8 - avgVisK) * 3) : 0;
      const occlusionRisk = clamp(Math.round(lowRisk * 0.45 + avgTotal * 0.30 + wetRisk * 0.20 + visibilityPenalty * 0.05));
      const clearPathBonus = gapQualityScore > 75 ? 8 : gapQualityScore > 60 ? 4 : gapQualityScore < 25 ? -10 : gapQualityScore < 40 ? -5 : 0;

      result[phase][ts] = {
        avgLow: Math.round(avgLow),
        avgMid: Math.round(avgMid),
        avgHigh: Math.round(avgHigh),
        avgTotal: Math.round(avgTotal),
        avgPp: Math.round(avgPp),
        avgVisK: Math.round(avgVisK * 10) / 10,
        lowRisk,
        wetRisk,
        horizonGapPct,
        gapQualityScore,
        occlusionRisk,
        clearPathBonus,
        sampleCount: bucket.samples,
      };
    }
  }

  return { byPhase: result };
}
