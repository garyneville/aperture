import { clamp } from '../../../lib/utils.js';
import type { ScoringCapability } from '../../../types/capabilities.js';
import type {
  DerivedHourFeatures,
  SessionConfidence,
  SessionId,
  SessionScore,
} from '../../../types/session-score.js';

export function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export function windSunCrossAngle(windDeg: number | null, sunAzimuthPhase: 'sunrise' | 'sunset' | null): number | null {
  if (windDeg == null || sunAzimuthPhase == null) return null;
  const sunAz = sunAzimuthPhase === 'sunrise' ? 90 : 270;
  const diff = Math.abs(((windDeg - sunAz + 540) % 360) - 180);
  return Math.round(sweetSpotScore(diff, 60, 120, 0, 180));
}

export function reflectionWindScore(windKph: number, gustKph: number): number {
  const calmScore = sweetSpotScore(windKph, 0, 4, 0, 14);
  const gustScore = sweetSpotScore(gustKph, 0, 8, 0, 20);
  return Math.round((calmScore * 0.65) + (gustScore * 0.35));
}

export function mistWindDirectionNote(windKph: number, windDeg: number | null): string | null {
  if (windDeg == null) return null;
  if (windKph <= 4) return `Light ${compassLabel(windDeg)} wind helps mist hold.`;
  if (windKph <= 10) return `Gentle ${compassLabel(windDeg)} breeze — mist may thin on exposed ground.`;
  return null;
}

export function wildlifeWindNote(windKph: number, gustKph: number, windDeg: number | null): string | null {
  if (windDeg == null) return null;
  const dir = compassLabel(windDeg);
  if (windKph <= 6 && gustKph <= 12) return `Very light ${dir} wind — ideal for quiet approach and stable long-lens work.`;
  if (windKph <= 12) return `Light ${dir} wind — plan your approach upwind of the subject.`;
  if (windKph <= 20) return `Moderate ${dir} wind — subjects may shelter on the lee side; expect restless perches.`;
  return `Strong ${dir} wind — challenging conditions for wildlife; subjects may hunker down.`;
}

export function sweetSpotScore(
  value: number,
  idealMin: number,
  idealMax: number,
  hardMin: number,
  hardMax: number,
): number {
  if (value <= hardMin || value >= hardMax) return 0;
  if (value >= idealMin && value <= idealMax) return 100;
  if (value < idealMin) {
    return clamp(Math.round(((value - hardMin) / (idealMin - hardMin)) * 100));
  }
  return clamp(Math.round(((hardMax - value) / (hardMax - idealMax)) * 100));
}

export function bellCurve(value: number, center: number, width: number): number {
  const z = (value - center) / width;
  return clamp(Math.round(100 * Math.exp(-0.5 * z * z)));
}

export function spreadVolatility(features: DerivedHourFeatures): number | null {
  if (features.ensembleCloudStdDevPct == null) return null;
  return Math.round(features.ensembleCloudStdDevPct);
}

export function confidenceFromSpread(
  spread: number | null,
  hardPass: boolean,
  highCutoff: number,
  mediumCutoff: number,
): SessionConfidence {
  if (!hardPass) return 'low';
  if (spread == null) return 'medium';
  if (spread < highCutoff) return 'high';
  if (spread < mediumCutoff) return 'medium';
  return 'low';
}

export function astroUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 8) return 0;
  return clamp(Math.round((spread - 8) * 0.9), 0, 22);
}

export function goldenHourUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 14) return 0;
  return clamp(Math.round((spread - 14) * 0.45), 0, 10);
}

export function mistUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 12) return 0;
  return clamp(Math.round((spread - 12) * 0.55), 0, 12);
}

export function mistVisibilitySweetSpot(visibilityKm: number): number {
  const sweetSpot = sweetSpotScore(visibilityKm, 1.2, 6, 0.4, 14);
  const denseFogPenalty = visibilityKm < 0.5 ? 28 : visibilityKm < 0.8 ? 14 : 0;
  return clamp(sweetSpot - denseFogPenalty);
}

export function mistDewPointAlignmentScore(dewPointSpreadC: number): number {
  return sweetSpotScore(dewPointSpreadC, 0, 1.2, -0.1, 5.5);
}

export function mistHumiditySupportScore(humidityPct: number): number {
  return sweetSpotScore(humidityPct, 92, 100, 75, 101);
}

export function mistWindPersistenceScore(windKph: number): number {
  return sweetSpotScore(windKph, 0, 6, -1, 25);
}

export function mistBoundaryLayerSupportScore(boundaryLayerHeightM: number | null | undefined): number | null {
  if (boundaryLayerHeightM == null) return null;
  return sweetSpotScore(boundaryLayerHeightM, 0, 350, -1, 1800);
}

export function stormVolatilityBonus(spread: number | null): number {
  if (spread == null) return 0;
  return Math.round(sweetSpotScore(spread, 8, 24, 0, 40) * 0.08);
}

export function urbanUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 10) return 0;
  return clamp(Math.round((spread - 10) * 0.5), 0, 12);
}

export function longExposureUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 10) return 0;
  return clamp(Math.round((spread - 10) * 0.6), 0, 14);
}

export function cloudOpticalWindowScore(features: DerivedHourFeatures): number {
  return sweetSpotScore(features.cloudOpticalThicknessPct, 18, 52, 0, 90);
}

export function wildlifeConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = hardPass
    && features.windKph <= 10
    && features.gustKph <= 18
    && features.visibilityKm >= 10
    && (features.isGolden || features.isBlue || (features.cloudTotalPct >= 45 && features.cloudTotalPct <= 80))
    && features.precipProbabilityPct <= 35
    && (features.lightningRisk ?? 0) < 20
    && (features.capeJkg ?? 0) < 800;
  if (!hardPass) return 'low';
  if (spread == null) return base ? 'medium' : 'low';
  return base && spread < 12 ? 'medium' : 'low';
}

export function goldenHourConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = features.cloudTotalPct >= 25
    && features.cloudTotalPct <= 75
    && features.visibilityKm >= 15
    && (features.hazeTrapRisk == null || features.hazeTrapRisk <= 55);
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 10, 24)
    : confidenceFromSpread(spread, hardPass, 8, 18);
}

export function astroConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const seeingOk = features.seeingScore == null || features.seeingScore >= 50;
  const bortleOk = features.lightPollutionBortle == null || features.lightPollutionBortle <= 5;
  const base = features.cloudTotalPct <= 15
    && features.moonIlluminationPct <= 30
    && features.transparencyScore >= 65
    && (features.hazeTrapRisk == null || features.hazeTrapRisk <= 55)
    && seeingOk
    && bortleOk;
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 6, 14)
    : confidenceFromSpread(spread, hardPass, 5, 10);
}

export function mistConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = features.dewPointSpreadC <= 1.5
    && features.humidityPct >= 92
    && features.windKph <= 8
    && features.visibilityKm >= 0.8
    && features.visibilityKm <= 8
    && (features.boundaryLayerHeightM == null || features.boundaryLayerHeightM <= 800);
  if (!hardPass || features.visibilityKm < 0.8) return 'low';
  if (spread == null) return base ? 'high' : 'medium';
  return base
    ? confidenceFromSpread(spread, hardPass, 8, 16)
    : confidenceFromSpread(spread, hardPass, 6, 12);
}

export function urbanConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const hasWetStreet = features.precipProbabilityPct >= 40
    || (features.surfaceWetnessScore != null && features.surfaceWetnessScore >= 60);
  const base = hasWetStreet && (features.isBlue || features.isNight) && features.windKph <= 10;
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 10, 20)
    : confidenceFromSpread(spread, hardPass, 8, 16);
}

export function longExposureConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = features.windKph <= 8 && features.gustKph <= 15 && (features.cloudTotalPct >= 25 || features.humidityPct >= 80);
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 8, 18)
    : confidenceFromSpread(spread, hardPass, 6, 14);
}

export function completeScore(
  session: SessionId,
  requiredCapabilities: ScoringCapability[],
  hardPass: boolean,
  score: number,
  confidence: SessionConfidence,
  volatility: number | null,
  reasons: string[],
  warnings: string[],
): SessionScore {
  return {
    session,
    score: hardPass ? clamp(Math.round(score)) : 0,
    hardPass,
    confidence,
    volatility,
    reasons,
    warnings,
    requiredCapabilities,
  };
}

export const GOLDEN_HOUR_CAPABILITIES: ScoringCapability[] = [
  'sun-geometry',
  'cloud-stratification',
  'visibility',
  'aerosols',
  'humidity',
  'wind',
];

export const ASTRO_CAPABILITIES: ScoringCapability[] = [
  'moon-geometry',
  'cloud-stratification',
  'visibility',
  'aerosols',
  'humidity',
  'light-pollution',
  'ensemble-confidence',
];

export const MIST_CAPABILITIES: ScoringCapability[] = [
  'visibility',
  'humidity',
  'wind',
  'precipitation',
];

export const STORM_CAPABILITIES: ScoringCapability[] = [
  'cloud-stratification',
  'precipitation',
  'wind',
  'aerosols',
  'sun-geometry',
  'upper-air',
];

export const URBAN_CAPABILITIES: ScoringCapability[] = [
  'precipitation',
  'visibility',
  'humidity',
  'wind',
  'aerosols',
  'surface-wetness',
];

export const LONG_EXPOSURE_CAPABILITIES: ScoringCapability[] = [
  'wind',
  'cloud-stratification',
  'visibility',
  'humidity',
  'sun-geometry',
];

export const WILDLIFE_CAPABILITIES: ScoringCapability[] = [
  'sun-geometry',
  'cloud-stratification',
  'visibility',
  'wind',
  'precipitation',
];
