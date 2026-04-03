import { clamp } from '../../../../lib/utils.js';
import type { SessionEvaluator } from '../../../../types/session-score.js';
import {
  STORM_CAPABILITIES,
  bellCurve,
  compassLabel,
  completeScore,
  confidenceFromSpread,
  spreadVolatility,
  stormVolatilityBonus,
  sweetSpotScore,
  windSunCrossAngle,
} from '../shared.js';

export const stormEvaluator: SessionEvaluator = {
  session: 'storm',
  requiredCapabilities: STORM_CAPABILITIES,
  evaluateHour(features) {
    const stormActivity = features.precipProbabilityPct >= 20
      || features.windKph >= 25
      || (features.capeJkg != null && features.capeJkg >= 500)
      || (features.lightningRisk != null && features.lightningRisk >= 10);
    const hardPass = features.cloudTotalPct >= 20 && features.cloudTotalPct <= 95 && stormActivity;
    const showerBand = bellCurve(features.precipProbabilityPct, 45, 22);
    const cloudStructure = sweetSpotScore(features.cloudTotalPct, 45, 85, 10, 100);
    const opticalWindow = sweetSpotScore(features.cloudOpticalThicknessPct, 28, 68, 10, 95);
    const capeBoost = features.capeJkg != null ? sweetSpotScore(features.capeJkg, 1200, 3500, 100, 5000) : 0;
    const lightningBoost = features.lightningRisk != null ? clamp(features.lightningRisk) : 0;
    const windPenalty = features.windKph > 45 ? 18 : features.windKph > 30 ? 8 : 0;
    const lowAngleBoost = features.isGolden || features.isBlue ? 16 : 0;
    const azimuthEdgeLightBoost = (features.isGolden || features.isBlue) && features.clearPathBonusPts != null
      ? features.clearPathBonusPts * 2
      : 0;
    const horizonGapBoost = (features.isGolden || features.isBlue) && features.horizonGapPct != null
      ? clamp(Math.round(sweetSpotScore(features.horizonGapPct, 55, 100, 15, 100) * 0.08), 0, 8)
      : 0;
    const horizonGapPenalty = (features.isGolden || features.isBlue) && features.horizonGapPct != null && features.horizonGapPct < 25
      ? clamp(Math.round((25 - features.horizonGapPct) * 0.3), 0, 6)
      : 0;
    const azimuthPenalty = (features.isGolden || features.isBlue) && features.azimuthOcclusionRiskPct != null
      ? features.azimuthOcclusionRiskPct > 70 ? 10 : features.azimuthOcclusionRiskPct > 55 ? 5 : 0
      : 0;
    const translucentHighBonus = clamp(Math.round(features.highCloudTranslucencyScore * 0.05), 0, 6);
    const lowCloudBlockPenalty = features.lowCloudBlockingScore >= 40
      ? clamp(Math.round((features.lowCloudBlockingScore - 40) * 0.16), 0, 10)
      : 0;
    const dramaCloudSynergy = Math.round(
      (features.dramaScore / 100) * bellCurve(features.cloudTotalPct, 60, 18) * 0.08,
    );
    const spread = spreadVolatility(features);
    const volatilityBonus = stormVolatilityBonus(spread);
    const score =
      (features.dramaScore * 0.4)
      + (features.crepuscularScore * 0.15)
      + (showerBand * 0.15)
      + (cloudStructure * 0.1)
      + (opticalWindow * 0.08)
      + (capeBoost * 0.1)
      + (lightningBoost * 0.05)
      + lowAngleBoost
      + azimuthEdgeLightBoost
      + horizonGapBoost
      + translucentHighBonus
      + dramaCloudSynergy
      + volatilityBonus
      - windPenalty
      - horizonGapPenalty
      - lowCloudBlockPenalty
      - azimuthPenalty;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (features.dramaScore >= 60 && cloudStructure >= 50) reasons.push('Cloud structure and illumination already look storm-friendly.');
    if (dramaCloudSynergy >= 4) reasons.push('Partial cloud should let dramatic breaks develop rather than flatten the scene.');
    if (features.cloudOpticalThicknessPct >= 28 && features.cloudOpticalThicknessPct <= 68) reasons.push('Cloud depth looks thick enough for drama without sealing the whole sky.');
    if (showerBand >= 60) reasons.push('Showery conditions could support rain shafts or fast-changing breaks.');
    if (features.isGolden || features.isBlue) reasons.push('Low-angle light improves the odds of rays and edge lighting.');
    if ((features.horizonGapPct ?? 0) >= 60 && (features.isGolden || features.isBlue)) reasons.push('A usable horizon gap should help edge-lighting break through.');
    if ((features.azimuthOcclusionRiskPct ?? 100) < 30 && (features.isGolden || features.isBlue)) reasons.push('The sun-side gap looks open enough for edge-lit breaks.');
    if ((features.capeJkg ?? 0) >= 1500) reasons.push('Convective energy is elevated enough for more dramatic development.');
    const stormAzPhase = (features.isGolden || features.isBlue)
      ? (features.isGolden ? (features.isBlue ? null : 'sunset' as const) : 'sunrise' as const)
      : null;
    const crossAngle = windSunCrossAngle(features.windDirectionDeg, stormAzPhase);
    if (crossAngle != null && crossAngle >= 65) reasons.push('Crosswind relative to the sun could drive rain shafts sideways for more dramatic framing.');
    if (features.windDirectionDeg != null && features.windKph > 15) {
      const dir = compassLabel(features.windDirectionDeg);
      reasons.push(`Storm movement from the ${dir} — position downwind for approaching fronts.`);
    }
    if (features.cloudTotalPct < 30) warnings.push('There may not be enough storm structure yet.');
    if (features.cloudTotalPct > 90) warnings.push('Dense overcast could flatten the scene before breaks appear.');
    if (features.dramaScore >= 60 && features.cloudTotalPct > 90) warnings.push('High drama score but overcast sky may not deliver visual payoff.');
    if (features.lowCloudBlockingScore >= 50) warnings.push('Dense low cloud could turn the storm sky flat instead of edge-lit.');
    if ((features.horizonGapPct ?? 100) < 25 && (features.isGolden || features.isBlue)) warnings.push('A narrow horizon gap may choke off edge-lighting even if cloud structure looks active.');
    if ((features.azimuthOcclusionRiskPct ?? 0) > 65 && (features.isGolden || features.isBlue)) warnings.push('Blocked sun-side cloud may limit edge-lighting and ray potential.');
    if (features.windKph > 35) warnings.push('Strong winds may make shooting awkward and reduce stability.');
    if ((features.lightningRisk ?? 0) >= 50) warnings.push('Elevated lightning risk warrants a safety-first setup.');
    if (!stormActivity) warnings.push('No precipitation, wind, or convective activity to support a storm session.');

    return completeScore(
      'storm',
      STORM_CAPABILITIES,
      hardPass,
      score,
      hardPass ? confidenceFromSpread(spread, hardPass, 10, 24) : 'low',
      spread,
      reasons,
      warnings,
    );
  },
};
