import { clamp } from '../../../../lib/utils.js';
import type { SessionEvaluator } from '../../../../types/session-score.js';
import {
  LONG_EXPOSURE_CAPABILITIES,
  completeScore,
  longExposureConfidence,
  longExposureUncertaintyPenalty,
  reflectionWindScore,
  spreadVolatility,
  sweetSpotScore,
} from '../shared.js';

export const longExposureEvaluator: SessionEvaluator = {
  session: 'long-exposure',
  requiredCapabilities: LONG_EXPOSURE_CAPABILITIES,
  evaluateHour(features) {
    const hardPass = features.windKph <= 30 && features.gustKph <= 45;
    const windStability = sweetSpotScore(features.windKph, 0, 8, 0, 30);
    const gustStability = sweetSpotScore(features.gustKph, 0, 15, 0, 45);
    const reflectionScore = reflectionWindScore(features.windKph, features.gustKph);
    const cloudInterest = sweetSpotScore(features.cloudTotalPct, 30, 80, 0, 100);
    const atmosphericMood = clamp(
      (features.mistScore >= 20 ? Math.min(features.mistScore, 80) : 0)
      + (features.humidityPct >= 75 ? Math.round((features.humidityPct - 75) * 1.2) : 0));
    const lowAngleBoost = features.isGolden || features.isBlue ? 14 : 0;
    const hazeSweetSpot = sweetSpotScore(features.aerosolOpticalDepth, 0.06, 0.2, 0.01, 0.4);
    const visibilityRange = sweetSpotScore(features.visibilityKm, 2, 18, 0.3, 40);
    const reflectionBonus = reflectionScore >= 80 ? 5 : 0;
    const windPenalty = features.windKph > 20 ? 16 : features.windKph > 12 ? 8 : 0;
    const gustPenalty = features.gustKph > 30 ? 10 : features.gustKph > 20 ? 5 : 0;
    const rainPenalty = features.precipProbabilityPct > 70 ? 12 : features.precipProbabilityPct > 40 ? 5 : 0;
    const spread = spreadVolatility(features);
    const uncertaintyPenalty = longExposureUncertaintyPenalty(spread);
    const score =
      (windStability * 0.25)
      + (cloudInterest * 0.2)
      + (gustStability * 0.15)
      + (atmosphericMood * 0.15)
      + (hazeSweetSpot * 0.1)
      + (visibilityRange * 0.15)
      + lowAngleBoost
      + reflectionBonus
      - windPenalty
      - gustPenalty
      - rainPenalty
      - uncertaintyPenalty;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (windStability >= 80) reasons.push('Calm winds are ideal for tripod stability and smooth exposures.');
    if (reflectionScore >= 75) reasons.push('Very light wind favours clean water reflections for long-exposure work.');
    if (cloudInterest >= 60) reasons.push('Cloud structure should streak nicely across a longer exposure.');
    if (atmosphericMood >= 30) reasons.push('Mist or humidity adds mood that rewards slower shutter work.');
    if (features.isGolden || features.isBlue) reasons.push('Low-angle light can produce dramatic long-exposure colour.');
    if (visibilityRange >= 60) reasons.push('Visibility suits the soft-but-present depth long exposures benefit from.');
    if (features.windKph > 20) warnings.push('Wind may cause camera shake or tripod vibration on longer exposures.');
    if (features.gustKph > 25) warnings.push('Gusts could introduce intermittent vibration during exposures.');
    if (features.precipProbabilityPct > 50) warnings.push('Rain risk may require weather protection for extended setups.');
    if (features.cloudTotalPct > 95) warnings.push('Heavy overcast may produce flat, featureless streaks.');
    if (features.cloudTotalPct < 10) warnings.push('Very few clouds may limit visual interest in longer exposures.');
    if (!hardPass) warnings.push('Wind or gust levels are too high for reliable long-exposure work.');

    return completeScore(
      'long-exposure',
      LONG_EXPOSURE_CAPABILITIES,
      hardPass,
      score,
      longExposureConfidence(features, hardPass),
      spread,
      reasons,
      warnings,
    );
  },
};
