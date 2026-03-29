import { clamp } from '../utils.js';
import type { DerivedHourFeatures } from '../../types/session-score.js';

export type DerivedHourFeatureInput = Omit<DerivedHourFeatures, 'dewPointSpreadC' | 'transparencyScore'>;

function estimateTransparencyScore(input: DerivedHourFeatureInput): number {
  const visibilityScore = clamp(Math.round((input.visibilityKm / 30) * 100));
  const humidityPenalty = clamp(Math.round((input.humidityPct - 70) * 0.9), 0, 22);
  const aerosolPenalty = clamp(Math.round((input.aerosolOpticalDepth - 0.08) * 180), 0, 25);
  const cloudPenalty = clamp(Math.round(input.cloudTotalPct * 0.2), 0, 20);
  return clamp(visibilityScore - humidityPenalty - aerosolPenalty - cloudPenalty);
}

export function deriveHourFeatures(input: DerivedHourFeatureInput): DerivedHourFeatures {
  return {
    ...input,
    dewPointSpreadC: Math.max(0, input.temperatureC - input.dewPointC),
    transparencyScore: estimateTransparencyScore(input),
  };
}
