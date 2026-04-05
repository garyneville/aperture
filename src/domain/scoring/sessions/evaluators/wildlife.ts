import { clamp } from '../../../../lib/utils.js';
import type { SessionEvaluator } from '../../../../types/session-score.js';
import {
  WILDLIFE_CAPABILITIES,
  completeScore,
  spreadVolatility,
  sweetSpotScore,
  wildlifeConfidence,
  wildlifeWindNote,
} from '../shared.js';

export const wildlifeEvaluator: SessionEvaluator = {
  session: 'wildlife',
  requiredCapabilities: WILDLIFE_CAPABILITIES,
  evaluateHour(features) {
    const lightningRisk = features.lightningRisk ?? 0;
    const capeJkg = features.capeJkg ?? 0;
    const hardPass = !features.isNight
      && features.visibilityKm >= 3
      && features.windKph <= 30
      && features.gustKph <= 40
      && features.precipProbabilityPct <= 85
      && lightningRisk < 50;

    const calmWind = sweetSpotScore(features.windKph, 0, 8, 0, 25);
    const gustControl = sweetSpotScore(features.gustKph, 0, 15, 0, 40);
    const softLight = features.isGolden
      ? 100
      : features.isBlue
        ? 85
        : features.diffuseToDirectRatio != null
          ? clamp(Math.round(sweetSpotScore(features.diffuseToDirectRatio, 0.8, 3.0, 0.1, 8.0)))
          : sweetSpotScore(features.cloudTotalPct, 45, 80, 10, 100);
    const visibilityWorking = sweetSpotScore(features.visibilityKm, 8, 30, 2, 40);
    const weatherQuiet = clamp(
      100
      - (features.precipProbabilityPct > 60 ? 35 : features.precipProbabilityPct > 35 ? 15 : 0)
      - (capeJkg >= 1500 ? 20 : capeJkg >= 800 ? 10 : 0)
      - (lightningRisk >= 40 ? 25 : lightningRisk >= 20 ? 10 : 0),
    );

    const windPenalty = features.windKph > 22 ? 16 : features.windKph > 14 ? 8 : 0;
    const gustPenalty = features.gustKph > 32 ? 12 : features.gustKph > 22 ? 6 : 0;
    const harshLightPenalty = !features.isGolden && !features.isBlue && features.cloudTotalPct < 30 ? 10 : 0;
    const hazePenalty = features.visibilityKm < 6 ? 10 : 0;
    const spread = spreadVolatility(features);
    const uncertaintyPenalty = spread == null ? 0 : clamp(Math.round((spread - 10) * 0.5), 0, 10);

    const score =
      (calmWind * 0.24)
      + (gustControl * 0.16)
      + (softLight * 0.18)
      + (visibilityWorking * 0.16)
      + (weatherQuiet * 0.14)
      + (features.overallScore * 0.08)
      - windPenalty
      - gustPenalty
      - harshLightPenalty
      - hazePenalty
      - uncertaintyPenalty
      - 10;

    const reasons: string[] = [];
    const warnings: string[] = [
      'This wildlife score is a coarse scaffold without species timing, habitat, or scent context.',
    ];

    const windNote = wildlifeWindNote(features.windKph, features.gustKph, features.windDirectionDeg);
    if (calmWind >= 70) reasons.push('Lighter winds should make subjects and longer lenses easier to manage.');
    if (windNote) reasons.push(windNote);
    if (softLight >= 70 && (features.isGolden || features.isBlue)) reasons.push('Soft low-angle light should be kinder on feathers, fur, and contrast.');
    else if (softLight >= 70 && features.diffuseToDirectRatio != null) reasons.push('The diffuse-to-direct radiation balance favours soft, even light for wildlife.');
    else if (softLight >= 70) reasons.push('Cloud-filtered light should suit wildlife contrast without harsh glare.');
    if (visibilityWorking >= 60) reasons.push('Visibility looks clear enough for longer-lens subject separation.');
    if (weatherQuiet >= 70) reasons.push('The broader weather pattern looks quiet enough for a general wildlife outing.');

    if (features.windKph > 18 || features.gustKph > 25) warnings.push('Wind may keep smaller subjects restless and move perches or foreground cover.');
    if (features.precipProbabilityPct > 60 || capeJkg >= 1200 || lightningRisk >= 20) warnings.push('Showery or stormy conditions could make animal movement less predictable.');
    if (features.visibilityKm < 6) warnings.push('Haze or murk may limit long-lens reach and subject separation.');
    if (!features.isGolden && !features.isBlue && features.cloudTotalPct < 30) warnings.push('Harsh direct light may flatten subjects and backgrounds.');
    if (features.isNight) warnings.push('This scaffold is tuned for daylight wildlife rather than nocturnal setups.');
    if (!hardPass) warnings.push('Current wind, visibility, or storm risk makes wildlife shooting less dependable.');

    return completeScore(
      'wildlife',
      WILDLIFE_CAPABILITIES,
      hardPass,
      score,
      wildlifeConfidence(features, hardPass),
      spread,
      reasons,
      warnings,
    );
  },
};
