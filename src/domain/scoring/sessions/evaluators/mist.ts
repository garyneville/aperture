import type { SessionEvaluator } from '../../../../types/session-score.js';
import {
  MIST_CAPABILITIES,
  completeScore,
  mistBoundaryLayerSupportScore,
  mistConfidence,
  mistDewPointAlignmentScore,
  mistHumiditySupportScore,
  mistUncertaintyPenalty,
  mistVisibilitySweetSpot,
  mistWindDirectionNote,
  mistWindPersistenceScore,
  spreadVolatility,
} from '../shared.js';

export const mistEvaluator: SessionEvaluator = {
  session: 'mist',
  requiredCapabilities: MIST_CAPABILITIES,
  evaluateHour(features) {
    const hardPass = (
      features.mistScore >= 30
      || features.humidityPct >= 90
      || (features.visibilityKm >= 0.4 && features.visibilityKm <= 12)
      || features.dewPointSpreadC <= 2.5
    ) && features.windKph <= 24 && features.visibilityKm >= 0.4;
    const visibilitySweetSpot = mistVisibilitySweetSpot(features.visibilityKm);
    const dewPointAlignment = mistDewPointAlignmentScore(features.dewPointSpreadC);
    const humiditySupport = mistHumiditySupportScore(features.humidityPct);
    const windPersistence = mistWindPersistenceScore(features.windKph);
    const boundaryLayerSupport = mistBoundaryLayerSupportScore(features.boundaryLayerHeightM);
    const rainPenalty = features.precipProbabilityPct > 85 ? 14 : features.precipProbabilityPct > 70 ? 8 : 0;
    const densityPenalty = features.visibilityKm < 0.5 ? 18 : features.visibilityKm < 0.8 ? 8 : 0;
    const spread = spreadVolatility(features);
    const uncertaintyPenalty = mistUncertaintyPenalty(spread);
    const components: Array<[number, number]> = [
      [features.mistScore, 0.34],
      [visibilitySweetSpot, 0.24],
      [dewPointAlignment, 0.16],
      [humiditySupport, 0.12],
      [windPersistence, 0.10],
      [100 - Math.min(features.clarityScore, 100), 0.04],
    ];
    if (boundaryLayerSupport != null) {
      components.push([boundaryLayerSupport, 0.10]);
    }
    const weightedScore = components.reduce((total, [value, weight]) => total + (value * weight), 0)
      / components.reduce((total, [, weight]) => total + weight, 0);
    const score =
      weightedScore
      - rainPenalty
      - densityPenalty
      - uncertaintyPenalty;
    const reasons: string[] = [];
    const warnings: string[] = [];

    const mistNote = mistWindDirectionNote(features.windKph, features.windDirectionDeg);
    if (visibilitySweetSpot >= 70) reasons.push('Visibility is in a useful misty-landscape range.');
    if (features.dewPointSpreadC <= 1.5) reasons.push('Temperature and dew point are close enough for fog formation.');
    if (windPersistence >= 70) reasons.push('Light winds should help shallow fog or mist hold together.');
    if (mistNote) reasons.push(mistNote);
    if ((boundaryLayerSupport ?? 0) >= 70) reasons.push('A low boundary layer should help mist or haze stay trapped near the ground.');
    if (features.visibilityKm < 0.8) warnings.push('Fog may be too dense for layered scenery rather than simply atmospheric.');
    if (features.visibilityKm > 12) warnings.push('Air looks quite clear for a dedicated mist session.');
    if (features.windKph > 12) warnings.push('Breezier conditions may mix out shallow fog.');
    if (features.boundaryLayerHeightM != null && features.boundaryLayerHeightM > 1200) warnings.push('A deep boundary layer may mix out low-level mist before it becomes photogenic.');
    if (features.precipProbabilityPct > 75) warnings.push('Persistent rain may turn mood into simple bad visibility.');

    return completeScore(
      'mist',
      MIST_CAPABILITIES,
      hardPass,
      score,
      mistConfidence(features, hardPass),
      spread,
      reasons,
      warnings,
    );
  },
};
