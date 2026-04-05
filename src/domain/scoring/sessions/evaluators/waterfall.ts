import { clamp } from '../../../../lib/utils.js';
import type { SessionEvaluator } from '../../../../types/session-score.js';
import {
  WATERFALL_CAPABILITIES,
  completeScore,
  waterfallConfidence,
  waterfallUncertaintyPenalty,
  spreadVolatility,
  sweetSpotScore,
} from '../shared.js';

export const waterfallEvaluator: SessionEvaluator = {
  session: 'waterfall',
  requiredCapabilities: WATERFALL_CAPABILITIES,
  evaluateHour(features) {
    const rainfall = features.recentRainfallMm ?? 0;
    const hasHydrology = features.recentRainfallMm != null;
    const highHumidity = features.humidityPct >= 90;

    const hardPass = (rainfall > 2 || highHumidity)
      && features.windKph <= 25
      && features.visibilityKm >= 2;

    // --- component scores ---

    // Rainfall sweet spot: 4–20 mm recent accumulation for good flow without flood
    const rainfallScore = hasHydrology
      ? sweetSpotScore(rainfall, 4, 20, 0.5, 50)
      : highHumidity ? 40 : 0;

    // Wind stability for long-exposure shooting
    const windScore = sweetSpotScore(features.windKph, 0, 8, -1, 30);

    // Gust penalty — gusts shake tripod and spray
    const gustScore = sweetSpotScore(features.gustKph, 0, 12, -1, 35);

    // Mist/atmosphere bonus — humidity creates atmosphere around falls
    const atmosphereScore = sweetSpotScore(features.humidityPct, 75, 95, 50, 101);

    // Visibility for scene depth around the waterfall
    const visibilityScore = sweetSpotScore(features.visibilityKm, 3, 15, 1, 30);

    // Golden-hour and soft-light boost
    const lightScore = features.isGolden
      ? 100
      : features.isBlue
        ? 70
        : sweetSpotScore(features.cloudTotalPct, 50, 85, 10, 100);

    // --- penalties ---

    const floodPenalty = hasHydrology && rainfall > 30 ? 15 : hasHydrology && rainfall > 20 ? 8 : 0;
    const windExcessPenalty = features.windKph > 20 ? 10 : features.windKph > 15 ? 5 : 0;
    const gustPenalty = features.gustKph > 25 ? 8 : features.gustKph > 18 ? 4 : 0;
    const rainActivePenalty = features.precipProbabilityPct > 80 ? 10 : features.precipProbabilityPct > 60 ? 5 : 0;
    const spread = spreadVolatility(features);
    const uncertaintyPenalty = waterfallUncertaintyPenalty(spread);

    // --- weighted average ---

    const score =
      (rainfallScore * 0.25)
      + (windScore * 0.18)
      + (gustScore * 0.08)
      + (atmosphereScore * 0.15)
      + (visibilityScore * 0.10)
      + (lightScore * 0.18)
      + (features.overallScore * 0.06)
      - floodPenalty
      - windExcessPenalty
      - gustPenalty
      - rainActivePenalty
      - uncertaintyPenalty;

    // --- reasons & warnings ---

    const reasons: string[] = [];
    const warnings: string[] = [];

    if (rainfallScore >= 60) reasons.push(`Recent rainfall (${rainfall.toFixed(1)} mm) should give good water flow for waterfall photography.`);
    else if (highHumidity && !hasHydrology) reasons.push('High humidity suggests damp conditions — some water flow likely.');
    if (windScore >= 70) reasons.push('Calm wind suits long-exposure waterfall work with stable tripod positioning.');
    if (atmosphereScore >= 60) reasons.push('Humidity should create atmospheric mist around the falls.');
    if (lightScore >= 70 && features.isGolden) reasons.push('Golden-hour light can warm the scene and catch spray highlights.');
    else if (lightScore >= 60 && features.isBlue) reasons.push('Soft blue-hour light suits moody, silky-water compositions.');
    else if (lightScore >= 50) reasons.push('Overcast light reduces contrast and eliminates harsh highlights on wet rock.');
    if (visibilityScore >= 60) reasons.push('Visibility gives good scene depth around the waterfall setting.');

    if (!hasHydrology && !highHumidity) warnings.push('No recent rainfall data and low humidity — waterfall flow may be insufficient.');
    if (hasHydrology && rainfall < 2 && !highHumidity) warnings.push('Very little recent rainfall — smaller waterfalls may be a trickle.');
    if (hasHydrology && rainfall > 20) warnings.push('Heavy recent rainfall — paths may be flooded and falls may be a torrent rather than photogenic.');
    if (features.windKph > 15) warnings.push('Moderate wind may cause spray drift and affect long-exposure stability.');
    if (features.gustKph > 20) warnings.push('Gusts may shake the tripod during long exposures.');
    if (features.precipProbabilityPct > 60) warnings.push('Active rain likely — lens protection essential; spray can add drama but complicates shooting.');
    if (features.visibilityKm < 3) warnings.push('Low visibility may limit scene depth but can add an intimate atmosphere.');
    if (!hardPass) warnings.push('Wind, visibility, or flow conditions fall outside the usable range for waterfall photography.');

    return completeScore(
      'waterfall',
      WATERFALL_CAPABILITIES,
      hardPass,
      score,
      waterfallConfidence(features, hardPass),
      spread,
      reasons,
      warnings,
    );
  },
};
