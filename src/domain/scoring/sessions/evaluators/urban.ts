import { clamp } from '../../../../lib/utils.js';
import type { SessionEvaluator } from '../../../../types/session-score.js';
import {
  URBAN_CAPABILITIES,
  completeScore,
  spreadVolatility,
  sweetSpotScore,
  urbanConfidence,
  urbanUncertaintyPenalty,
} from '../shared.js';

export const urbanEvaluator: SessionEvaluator = {
  session: 'urban',
  requiredCapabilities: URBAN_CAPABILITIES,
  evaluateHour(features) {
    const hasWetSurface = features.precipProbabilityPct >= 30
      || (features.surfaceWetnessScore != null && features.surfaceWetnessScore >= 40);
    const hasAtmosphere = features.humidityPct >= 80
      || features.visibilityKm <= 12
      || features.cloudTotalPct >= 60;
    const hasCityLight = features.isBlue || features.isNight;
    const hardPass = (hasWetSurface || hasAtmosphere || hasCityLight) && features.windKph <= 35;

    const wetStreetScore = features.surfaceWetnessScore != null
      ? clamp(features.surfaceWetnessScore)
      : sweetSpotScore(features.precipProbabilityPct, 30, 70, 5, 100);
    const atmosphericMood = features.dramaScore;
    const visibilitySweetSpot = sweetSpotScore(features.visibilityKm, 3, 15, 0.5, 30);
    const cityLightBoost = features.isBlue ? 100 : features.isNight ? 80 : 0;
    const humidityContrib = clamp(Math.round((features.humidityPct - 50) * 2));
    const hazeSweetSpot = sweetSpotScore(features.aerosolOpticalDepth, 0.06, 0.2, 0.01, 0.4);

    const windPenalty = features.windKph > 30 ? 14 : features.windKph > 20 ? 6 : 0;
    const heavyRainPenalty = features.precipProbabilityPct > 85 ? 8 : 0;
    const spread = spreadVolatility(features);
    const uncertaintyPenalty = urbanUncertaintyPenalty(spread);

    const score =
      (wetStreetScore * 0.35)
      + (atmosphericMood * 0.2)
      + (visibilitySweetSpot * 0.15)
      + (cityLightBoost * 0.15)
      + (humidityContrib * 0.1)
      + (hazeSweetSpot * 0.05)
      - windPenalty
      - heavyRainPenalty
      - uncertaintyPenalty;

    const reasons: string[] = [];
    const warnings: string[] = [];

    if (wetStreetScore >= 60) reasons.push('Recent or active rain should leave wet streets for reflections.');
    if (visibilitySweetSpot >= 60 && features.visibilityKm <= 12) reasons.push('Atmospheric haze adds depth to city scenes.');
    if (hasCityLight) reasons.push('Blue-hour or night light suits moody urban photography.');
    if (features.cloudTotalPct >= 70) reasons.push('Overcast skies diffuse light evenly across street scenes.');
    if (features.humidityPct >= 80) reasons.push('Humidity helps surfaces hold a reflective sheen.');

    if (!hasWetSurface && features.humidityPct < 70) warnings.push('Dry conditions reduce the reflective atmosphere urban shooting benefits from.');
    if (features.windKph > 25) warnings.push('Strong wind may make tripod setups or umbrella handling difficult.');
    if (features.precipProbabilityPct > 85) warnings.push('Heavy continuous rain may obscure scenes more than help reflections.');
    if (!hasCityLight && !features.isGolden && features.cloudTotalPct < 40) warnings.push('Midday light without atmosphere can flatten urban scenes.');

    return completeScore(
      'urban',
      URBAN_CAPABILITIES,
      hardPass,
      score,
      urbanConfidence(features, hardPass),
      spread,
      reasons,
      warnings,
    );
  },
};
