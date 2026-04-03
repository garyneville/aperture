import { clamp } from '../../../../lib/utils.js';
import type { SessionEvaluator } from '../../../../types/session-score.js';
import {
  GOLDEN_HOUR_CAPABILITIES,
  bellCurve,
  cloudOpticalWindowScore,
  completeScore,
  goldenHourConfidence,
  goldenHourUncertaintyPenalty,
  compassLabel,
  spreadVolatility,
  sweetSpotScore,
} from '../shared.js';

export const goldenHourEvaluator: SessionEvaluator = {
  session: 'golden-hour',
  requiredCapabilities: GOLDEN_HOUR_CAPABILITIES,
  evaluateHour(features) {
    const hardPass = features.isGolden || features.isBlue;
    const cloudCanvas = bellCurve(features.cloudTotalPct, 50, 22);
    const opticalWindow = cloudOpticalWindowScore(features);
    const hazeSweetSpot = sweetSpotScore(features.aerosolOpticalDepth, 0.08, 0.18, 0.02, 0.35);
    const windPenalty = features.windKph > 30 ? 12 : features.windKph > 20 ? 6 : 0;
    const visibilityPenalty = features.visibilityKm < 8 ? 18 : features.visibilityKm < 15 ? 8 : 0;
    const occ = features.azimuthOcclusionRiskPct != null ? features.azimuthOcclusionRiskPct / 100 : 0;
    const azimuthPenalty = features.azimuthOcclusionRiskPct != null
      ? clamp(Math.round(occ * occ * 22), 0, 22)
      : 0;
    const clearPathBoost = features.clearPathBonusPts != null ? features.clearPathBonusPts * 2 : 0;
    const horizonGapBoost = features.horizonGapPct != null
      ? clamp(Math.round(sweetSpotScore(features.horizonGapPct, 60, 100, 20, 100) * 0.08), 0, 8)
      : 0;
    const horizonGapPenalty = features.horizonGapPct != null && features.horizonGapPct < 30
      ? clamp(Math.round((30 - features.horizonGapPct) * 0.3), 0, 8)
      : 0;
    const clearSkyPenalty = features.cloudTotalPct < 15 ? clamp(Math.round((15 - features.cloudTotalPct) * 0.6)) : 0;
    const translucentHighBonus = clamp(Math.round(features.highCloudTranslucencyScore * 0.08), 0, 8);
    const lowCloudBlockPenalty = features.lowCloudBlockingScore >= 35
      ? clamp(Math.round((features.lowCloudBlockingScore - 35) * 0.16), 0, 12)
      : 0;
    const trappedHazePenalty = features.hazeTrapRisk == null
      ? 0
      : clamp(Math.round((features.hazeTrapRisk - 45) * 0.16), 0, 10);
    const spread = spreadVolatility(features);
    const uncertaintyPenalty = goldenHourUncertaintyPenalty(spread);
    const score =
      (features.overallScore * 0.35)
      + (features.dramaScore * 0.25)
      + (features.crepuscularScore * 0.15)
      + (cloudCanvas * 0.15)
      + (opticalWindow * 0.08)
      + (hazeSweetSpot * 0.1)
      + clearPathBoost
      + horizonGapBoost
      + translucentHighBonus
      - windPenalty
      - visibilityPenalty
      - azimuthPenalty
      - horizonGapPenalty
      - clearSkyPenalty
      - lowCloudBlockPenalty
      - trappedHazePenalty
      - uncertaintyPenalty;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (cloudCanvas >= 70) reasons.push('Broken cloud cover can catch low-angle light well.');
    if (features.highCloudTranslucencyScore >= 90) reasons.push('Upper cloud looks thin enough to catch colour without sealing the sky.');
    if (features.crepuscularScore >= 40) reasons.push('Crepuscular-ray potential is already elevated.');
    if (features.visibilityKm >= 18) reasons.push('Visibility should preserve depth and distant contrast.');
    if ((features.horizonGapPct ?? 0) >= 65) reasons.push('The horizon gap looks open enough for low-angle light to reach the scene.');
    if ((features.azimuthOcclusionRiskPct ?? 100) < 25) reasons.push('Low-angle light path looks relatively clear.');
    if (features.cloudTotalPct < 15) warnings.push('Clear sky may lack the cloud texture needed for dramatic colour.');
    if (features.cloudTotalPct >= 90) warnings.push('Featureless overcast may flatten the light.');
    if (features.lowCloudBlockingScore >= 40) warnings.push('Dense low cloud may block the sun-side glow before it reaches the scene.');
    if (features.visibilityKm < 10) warnings.push('Heavy haze could mute contrast despite good color.');
    if ((features.horizonGapPct ?? 100) <= 25) warnings.push('The horizon gap looks narrow for reliable low-angle light.');
    if ((features.hazeTrapRisk ?? 0) >= 65) warnings.push('A shallow boundary layer may trap haze and flatten distant contrast.');
    if (features.windKph > 25) {
      const dirNote = features.windDirectionDeg != null ? ` from the ${compassLabel(features.windDirectionDeg)}` : '';
      warnings.push(`Wind${dirNote} may make long-lens or tripod work fussier.`);
    }
    if ((features.azimuthOcclusionRiskPct ?? 0) > 60) warnings.push('Low-angle light may be blocked near the horizon.');
    if (!hardPass) warnings.push('This hour is outside the low-angle light window.');

    return completeScore(
      'golden-hour',
      GOLDEN_HOUR_CAPABILITIES,
      hardPass,
      score,
      goldenHourConfidence(features, hardPass),
      spread,
      reasons,
      warnings,
    );
  },
};
