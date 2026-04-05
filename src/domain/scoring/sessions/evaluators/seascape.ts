import { clamp } from '../../../../lib/utils.js';
import type { SessionEvaluator } from '../../../../types/session-score.js';
import {
  SEASCAPE_CAPABILITIES,
  completeScore,
  seascapeConfidence,
  seascapeUncertaintyPenalty,
  spreadVolatility,
  sweetSpotScore,
  compassLabel,
} from '../shared.js';

export const seascapeEvaluator: SessionEvaluator = {
  session: 'seascape',
  requiredCapabilities: SEASCAPE_CAPABILITIES,
  evaluateHour(features) {
    const swellM = features.swellHeightM;
    const periodS = features.swellPeriodS;
    const hasMarine = swellM != null && periodS != null;

    const hardPass = hasMarine
      && swellM >= 0.3
      && swellM <= 4.0
      && features.windKph <= 40
      && features.visibilityKm >= 3;

    // --- component scores ---

    // Swell height sweet-spot: 0.5–2.0 m ideal for scenic drama without danger
    const swellHeightScore = hasMarine
      ? sweetSpotScore(swellM, 0.5, 2.0, 0.2, 5.0)
      : 0;

    // Swell period: 8–14 s gives well-formed waves with good visual rhythm
    const swellPeriodScore = hasMarine
      ? sweetSpotScore(periodS, 8, 14, 4, 22)
      : 0;

    // Low-angle light bonus — seascape benefits heavily from golden/blue hour
    const lightScore = features.isGolden
      ? 100
      : features.isBlue
        ? 80
        : features.crepuscularScore >= 40
          ? clamp(features.crepuscularScore)
          : sweetSpotScore(features.cloudTotalPct, 30, 70, 5, 95);

    // Wind usability — some wind adds spray texture, too much is dangerous
    const windScore = sweetSpotScore(features.windKph, 8, 22, 0, 45);

    // Visibility for coastal depth and horizon clarity
    const visibilityScore = sweetSpotScore(features.visibilityKm, 10, 35, 2, 50);

    // Cloud drama — broken cloud catching light over ocean
    const cloudDramaScore = sweetSpotScore(features.cloudTotalPct, 25, 65, 0, 100);

    // --- penalties ---

    const heavySwellPenalty = hasMarine && swellM > 3.0 ? 12 : hasMarine && swellM > 2.5 ? 6 : 0;
    const windExcessPenalty = features.windKph > 35 ? 14 : features.windKph > 28 ? 8 : 0;
    const gustPenalty = features.gustKph > 45 ? 10 : features.gustKph > 35 ? 5 : 0;
    const rainPenalty = features.precipProbabilityPct > 80 ? 12 : features.precipProbabilityPct > 60 ? 6 : 0;
    const hazePenalty = features.visibilityKm < 6 ? 8 : 0;
    const spread = spreadVolatility(features);
    const uncertaintyPenalty = seascapeUncertaintyPenalty(spread);

    // --- weighted average ---

    const score =
      (swellHeightScore * 0.22)
      + (swellPeriodScore * 0.14)
      + (lightScore * 0.22)
      + (windScore * 0.14)
      + (visibilityScore * 0.12)
      + (cloudDramaScore * 0.10)
      + (features.overallScore * 0.06)
      - heavySwellPenalty
      - windExcessPenalty
      - gustPenalty
      - rainPenalty
      - hazePenalty
      - uncertaintyPenalty;

    // --- reasons & warnings ---

    const reasons: string[] = [];
    const warnings: string[] = [];

    if (swellHeightScore >= 70) reasons.push(`Swell height (${swellM?.toFixed(1)} m) is in a good range for scenic wave drama.`);
    if (swellPeriodScore >= 60) reasons.push(`Wave period (${periodS?.toFixed(0)} s) should produce well-formed, photogenic sets.`);
    if (lightScore >= 70 && features.isGolden) reasons.push('Golden-hour light over the ocean should give rich colour and long shadows across the waves.');
    else if (lightScore >= 70 && features.isBlue) reasons.push('Blue-hour light suits moody, long-exposure seascape work.');
    else if (lightScore >= 60) reasons.push('Light conditions look reasonable for coastal atmosphere.');
    if (windScore >= 60) reasons.push('Wind speed is moderate enough for spray texture without it being dangerous.');
    if (visibilityScore >= 60) reasons.push('Visibility should give good horizon definition and coastal depth.');
    if (cloudDramaScore >= 60) reasons.push('Broken cloud over the ocean can create dramatic light and shadow patterns.');

    if (!hasMarine) warnings.push('No marine swell data available — seascape score cannot be calculated reliably.');
    if (hasMarine && swellM > 2.5) warnings.push('Heavy swell — take care near wave-exposed positions and keep a safe distance from the water.');
    if (hasMarine && swellM < 0.4) warnings.push('Very light swell may lack wave drama — consider long-exposure or minimalist compositions instead.');
    if (features.windKph > 28) {
      const windDir = features.windDirectionDeg != null ? ` (${compassLabel(features.windDirectionDeg)})` : '';
      warnings.push(`Strong wind${windDir} — expect significant spray and challenging tripod stability.`);
    }
    if (features.gustKph > 35) warnings.push('Gusts may make safe positioning and stable shooting difficult.');
    if (features.precipProbabilityPct > 60) warnings.push('Rain risk is elevated — lens protection and waterproofing needed.');
    if (features.visibilityKm < 6) warnings.push('Haze or murk may reduce horizon contrast and coastal atmosphere.');
    if (!hardPass && hasMarine) warnings.push('Swell, wind, or visibility conditions fall outside the usable range for seascape photography.');

    return completeScore(
      'seascape',
      SEASCAPE_CAPABILITIES,
      hardPass,
      score,
      seascapeConfidence(features, hardPass),
      spread,
      reasons,
      warnings,
    );
  },
};
