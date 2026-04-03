import { clamp } from '../utils.js';
import type { DerivedHourFeatures } from '../../types/session-score.js';

export type DerivedHourFeatureInput = Omit<
  DerivedHourFeatures,
  | 'dewPointSpreadC'
  | 'transparencyScore'
  | 'boundaryLayerTrapScore'
  | 'hazeTrapRisk'
  | 'cloudOpticalThicknessPct'
  | 'highCloudTranslucencyScore'
  | 'lowCloudBlockingScore'
>;

function sweetSpotScore(
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

function estimateBoundaryLayerTrapScore(input: DerivedHourFeatureInput): number | null {
  if (input.boundaryLayerHeightM == null) return null;
  if (input.boundaryLayerHeightM <= 250) return 100;
  if (input.boundaryLayerHeightM >= 1800) return 0;
  return clamp(Math.round(((1800 - input.boundaryLayerHeightM) / (1800 - 250)) * 100));
}

function estimateCloudOpticalThicknessPct(input: DerivedHourFeatureInput): number {
  const overlapDensity = clamp(
    input.cloudTotalPct
    - ((input.cloudLowPct * 0.45) + (input.cloudMidPct * 0.30) + (input.cloudHighPct * 0.20)),
    0,
    100,
  );

  return clamp(Math.round(
    (input.cloudLowPct * 0.70)
    + (input.cloudMidPct * 0.35)
    + (input.cloudHighPct * 0.10)
    + (overlapDensity * 0.35),
  ));
}

function estimateHighCloudTranslucencyScore(
  input: DerivedHourFeatureInput,
  cloudOpticalThicknessPct: number,
): number {
  const highSupport = sweetSpotScore(input.cloudHighPct, 18, 65, 0, 90);
  const lowClearance = sweetSpotScore(100 - input.cloudLowPct, 65, 100, 20, 100);
  const opticalWindow = sweetSpotScore(cloudOpticalThicknessPct, 15, 45, 0, 80);
  const midTexture = sweetSpotScore(input.cloudMidPct, 8, 35, 0, 70);

  return clamp(Math.round(
    (highSupport * 0.45)
    + (lowClearance * 0.20)
    + (opticalWindow * 0.25)
    + (midTexture * 0.10),
  ));
}

function estimateLowCloudBlockingScore(
  input: DerivedHourFeatureInput,
  cloudOpticalThicknessPct: number,
): number {
  const lowBurden = input.cloudLowPct * 0.60;
  const opticalBurden = cloudOpticalThicknessPct * 0.30;
  const overcastBurden = Math.max(0, input.cloudTotalPct - 70) * 0.35;
  const lowDominanceBonus = input.cloudTotalPct > 0
    ? (input.cloudLowPct / input.cloudTotalPct) * 20
    : 0;

  return clamp(Math.round(lowBurden + opticalBurden + overcastBurden + lowDominanceBonus));
}

function estimateHazeTrapRisk(input: DerivedHourFeatureInput, boundaryLayerTrapScore: number | null): number | null {
  if (boundaryLayerTrapScore == null) return null;

  const humiditySupport = clamp(Math.round((input.humidityPct - 72) * 2.2), 0, 100);
  const aerosolLoad = clamp(Math.round((input.aerosolOpticalDepth - 0.08) * 420), 0, 100);
  const lowVisibilityPenalty = input.visibilityKm < 14
    ? clamp(Math.round((14 - input.visibilityKm) * 6), 0, 100)
    : 0;

  return clamp(Math.round(
    (boundaryLayerTrapScore * 0.5)
    + (humiditySupport * 0.25)
    + (aerosolLoad * 0.2)
    + (lowVisibilityPenalty * 0.05),
  ));
}

function estimateTransparencyScore(input: DerivedHourFeatureInput): number {
  const visibilityScore = clamp(Math.round((input.visibilityKm / 30) * 100));
  const humidityPenalty = clamp(Math.round((input.humidityPct - 70) * 0.9), 0, 22);
  const aerosolPenalty = clamp(Math.round((input.aerosolOpticalDepth - 0.08) * 180), 0, 25);
  const cloudPenalty = clamp(Math.round(input.cloudTotalPct * 0.2), 0, 20);
  const boundaryLayerTrapScore = estimateBoundaryLayerTrapScore(input);
  const hazeTrapRisk = estimateHazeTrapRisk(input, boundaryLayerTrapScore);
  const trappedHazePenalty = hazeTrapRisk == null
    ? 0
    : clamp(Math.round((hazeTrapRisk - 35) * 0.28), 0, 18);

  return clamp(visibilityScore - humidityPenalty - aerosolPenalty - cloudPenalty - trappedHazePenalty);
}

/**
 * Estimates astronomical seeing quality (0-100, higher = steadier atmosphere)
 * from available meteorological proxies.
 *
 * Seeing is driven by atmospheric turbulence through the optical column.
 * Key drivers per operational astronomy forecasters:
 *   - Surface wind gustiness (gust spread indicates boundary-layer turbulence)
 *   - Boundary-layer height (deeper BLH = more convective mixing = worse seeing)
 *   - CAPE (convective instability drives thermal cells that degrade seeing)
 *   - Vertical wind shear (strong shear produces turbulent layers)
 *
 * Returns null when no usable proxy data is available (all inputs absent).
 * When an external seeingScore is already provided, this function is not called.
 */
function estimateSeeingProxy(input: DerivedHourFeatureInput): number | null {
  const hasAnyProxy = input.boundaryLayerHeightM != null
    || input.capeJkg != null
    || input.verticalShearKts != null;
  if (!hasAnyProxy && input.gustKph <= input.windKph) return null;

  // Boundary-layer turbulence risk: gustiness + wind speed + BLH
  const gustSpread = Math.max(0, input.gustKph - input.windKph);
  const gustRisk = clamp(Math.round((gustSpread - 4) * 4), 0, 100);
  const windRisk = clamp(Math.round((input.windKph - 6) * 3), 0, 100);
  const blhRisk = input.boundaryLayerHeightM != null
    ? clamp(Math.round((input.boundaryLayerHeightM - 300) * 0.07), 0, 100)
    : 50; // moderate assumption when unknown

  // Convective risk: CAPE drives thermal bubbles that degrade seeing
  const capeRisk = input.capeJkg != null
    ? clamp(Math.round((input.capeJkg - 50) * 0.06), 0, 100)
    : 0;

  // Upper-air shear risk: strong shear → turbulent layers
  const shearRisk = input.verticalShearKts != null
    ? clamp(Math.round((input.verticalShearKts - 12) * 2.5), 0, 100)
    : 0;

  // Weighted combination — boundary-layer turbulence dominates for ground-based seeing
  const totalRisk = Math.round(
    (gustRisk * 0.30)
    + (windRisk * 0.15)
    + (blhRisk * 0.20)
    + (capeRisk * 0.20)
    + (shearRisk * 0.15),
  );

  return clamp(100 - totalRisk);
}

export function deriveHourFeatures(input: DerivedHourFeatureInput): DerivedHourFeatures {
  const boundaryLayerTrapScore = estimateBoundaryLayerTrapScore(input);
  const hazeTrapRisk = estimateHazeTrapRisk(input, boundaryLayerTrapScore);
  const cloudOpticalThicknessPct = estimateCloudOpticalThicknessPct(input);
  const highCloudTranslucencyScore = estimateHighCloudTranslucencyScore(input, cloudOpticalThicknessPct);
  const lowCloudBlockingScore = estimateLowCloudBlockingScore(input, cloudOpticalThicknessPct);

  // Populate seeingScore from proxy when no external value is provided
  const seeingScore = input.seeingScore != null
    ? input.seeingScore
    : estimateSeeingProxy(input);

  return {
    ...input,
    seeingScore,
    dewPointSpreadC: Math.max(0, input.temperatureC - input.dewPointC),
    boundaryLayerTrapScore,
    hazeTrapRisk,
    cloudOpticalThicknessPct,
    highCloudTranslucencyScore,
    lowCloudBlockingScore,
    transparencyScore: estimateTransparencyScore(input),
  };
}
