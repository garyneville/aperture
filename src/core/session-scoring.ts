import { clamp } from './utils.js';
import type { ScoringCapability } from '../types/capabilities.js';
import type {
  DerivedHourFeatures,
  SessionConfidence,
  SessionEvaluator,
  SessionHourSelection,
  SessionId,
  SessionRecommendation,
  SessionRecommendationSummary,
  SessionScore,
} from '../types/session-score.js';

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

function spreadVolatility(features: DerivedHourFeatures): number | null {
  if (features.ensembleCloudStdDevPct == null) return null;
  return Math.round(features.ensembleCloudStdDevPct);
}

function confidenceFromSpread(
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

function astroUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 8) return 0;
  return clamp(Math.round((spread - 8) * 0.9), 0, 22);
}

function goldenHourUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 14) return 0;
  return clamp(Math.round((spread - 14) * 0.45), 0, 10);
}

function mistUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 12) return 0;
  return clamp(Math.round((spread - 12) * 0.55), 0, 12);
}

function stormVolatilityBonus(spread: number | null): number {
  if (spread == null) return 0;
  return Math.round(sweetSpotScore(spread, 8, 24, 0, 40) * 0.08);
}

function longExposureUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 10) return 0;
  return clamp(Math.round((spread - 10) * 0.6), 0, 14);
}

function goldenHourConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = features.cloudTotalPct >= 25 && features.cloudTotalPct <= 75 && features.visibilityKm >= 15;
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 10, 24)
    : confidenceFromSpread(spread, hardPass, 8, 18);
}

function astroConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = features.cloudTotalPct <= 15 && features.moonIlluminationPct <= 30 && features.transparencyScore >= 65;
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 6, 14)
    : confidenceFromSpread(spread, hardPass, 5, 10);
}

function mistConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = features.dewPointSpreadC <= 1.5 && features.humidityPct >= 92 && features.windKph <= 8;
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 9, 18)
    : confidenceFromSpread(spread, hardPass, 7, 15);
}

function longExposureConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = features.windKph <= 8 && features.gustKph <= 15 && (features.cloudTotalPct >= 25 || features.humidityPct >= 80);
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 8, 18)
    : confidenceFromSpread(spread, hardPass, 6, 14);
}

function completeScore(
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

const GOLDEN_HOUR_CAPABILITIES: ScoringCapability[] = [
  'sun-geometry',
  'cloud-stratification',
  'visibility',
  'aerosols',
  'humidity',
  'wind',
];

const ASTRO_CAPABILITIES: ScoringCapability[] = [
  'moon-geometry',
  'cloud-stratification',
  'visibility',
  'aerosols',
  'humidity',
  'light-pollution',
  'ensemble-confidence',
];

const MIST_CAPABILITIES: ScoringCapability[] = [
  'visibility',
  'humidity',
  'wind',
  'precipitation',
];

const STORM_CAPABILITIES: ScoringCapability[] = [
  'cloud-stratification',
  'precipitation',
  'wind',
  'aerosols',
  'sun-geometry',
  'upper-air',
];

const LONG_EXPOSURE_CAPABILITIES: ScoringCapability[] = [
  'wind',
  'cloud-stratification',
  'visibility',
  'humidity',
  'sun-geometry',
];

const goldenHourEvaluator: SessionEvaluator = {
  session: 'golden-hour',
  requiredCapabilities: GOLDEN_HOUR_CAPABILITIES,
  evaluateHour(features) {
    const hardPass = features.isGolden || features.isBlue;
    const cloudCanvas = sweetSpotScore(features.cloudTotalPct, 35, 70, 5, 100);
    const hazeSweetSpot = sweetSpotScore(features.aerosolOpticalDepth, 0.08, 0.18, 0.02, 0.35);
    const windPenalty = features.windKph > 30 ? 12 : features.windKph > 20 ? 6 : 0;
    const visibilityPenalty = features.visibilityKm < 8 ? 18 : features.visibilityKm < 15 ? 8 : 0;
    const azimuthPenalty = features.azimuthOcclusionRiskPct != null
      ? features.azimuthOcclusionRiskPct > 75 ? 16 : features.azimuthOcclusionRiskPct > 55 ? 8 : 0
      : 0;
    const clearPathBoost = features.clearPathBonusPts != null ? features.clearPathBonusPts * 2 : 0;
    const spread = spreadVolatility(features);
    const uncertaintyPenalty = goldenHourUncertaintyPenalty(spread);
    const score =
      (features.overallScore * 0.35)
      + (features.dramaScore * 0.25)
      + (features.crepuscularScore * 0.15)
      + (cloudCanvas * 0.15)
      + (hazeSweetSpot * 0.1)
      + clearPathBoost
      - windPenalty
      - visibilityPenalty
      - azimuthPenalty
      - uncertaintyPenalty;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (cloudCanvas >= 70) reasons.push('Broken cloud cover can catch low-angle light well.');
    if (features.crepuscularScore >= 40) reasons.push('Crepuscular-ray potential is already elevated.');
    if (features.visibilityKm >= 18) reasons.push('Visibility should preserve depth and distant contrast.');
    if ((features.azimuthOcclusionRiskPct ?? 100) < 25) reasons.push('Low-angle light path looks relatively clear.');
    if (features.cloudTotalPct >= 90) warnings.push('Featureless overcast may flatten the light.');
    if (features.visibilityKm < 10) warnings.push('Heavy haze could mute contrast despite good color.');
    if (features.windKph > 25) warnings.push('Wind may make long-lens or tripod work fussier.');
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

const astroEvaluator: SessionEvaluator = {
  session: 'astro',
  requiredCapabilities: ASTRO_CAPABILITIES,
  evaluateHour(features) {
    const hardPass = features.isNight && features.cloudTotalPct <= 70;
    const moonPenalty = features.moonIlluminationPct > 70 ? 25 : features.moonIlluminationPct > 40 ? 12 : 0;
    const cloudPenalty = features.cloudTotalPct > 40 ? 16 : features.cloudTotalPct > 20 ? 8 : 0;
    const spread = spreadVolatility(features);
    const uncertaintyPenalty = astroUncertaintyPenalty(spread);
    const score =
      (features.astroScore * 0.6)
      + (features.transparencyScore * 0.25)
      + (Math.max(0, 100 - features.moonIlluminationPct) * 0.15)
      - moonPenalty
      - cloudPenalty
      - uncertaintyPenalty;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (features.cloudTotalPct <= 20) reasons.push('Cloud cover is low enough for a plausible dark-sky run.');
    if (features.moonIlluminationPct <= 30) reasons.push('Moonlight should stay subdued for darker skies.');
    if (features.transparencyScore >= 60) reasons.push('Current haze and humidity look workable for transparency.');
    if (!features.isNight) warnings.push('This hour is not inside a darkness window.');
    if (features.cloudTotalPct > 40) warnings.push('Cloud cover is getting close to an astro deal-breaker.');
    if (features.moonIlluminationPct > 50) warnings.push('Bright moonlight may wash out faint targets.');

    return completeScore(
      'astro',
      ASTRO_CAPABILITIES,
      hardPass,
      score,
      astroConfidence(features, hardPass),
      spread,
      reasons,
      warnings,
    );
  },
};

const mistEvaluator: SessionEvaluator = {
  session: 'mist',
  requiredCapabilities: MIST_CAPABILITIES,
  evaluateHour(features) {
    const hardPass = (
      features.mistScore >= 30
      || features.humidityPct >= 88
      || features.visibilityKm <= 10
      || features.dewPointSpreadC <= 3
    ) && features.windKph <= 25;
    const visibilitySweetSpot = sweetSpotScore(features.visibilityKm, 1.5, 8, 0.1, 18);
    const dewPointAlignment = clamp(Math.round(100 - (features.dewPointSpreadC * 18)));
    const windPenalty = features.windKph > 18 ? 14 : features.windKph > 10 ? 6 : 0;
    const rainPenalty = features.precipProbabilityPct > 75 ? 10 : 0;
    const spread = spreadVolatility(features);
    const uncertaintyPenalty = mistUncertaintyPenalty(spread);
    const score =
      (features.mistScore * 0.45)
      + (visibilitySweetSpot * 0.2)
      + (dewPointAlignment * 0.15)
      + (features.humidityPct * 0.15)
      + ((100 - Math.min(features.clarityScore, 100)) * 0.05)
      - windPenalty
      - rainPenalty
      - uncertaintyPenalty;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (visibilitySweetSpot >= 70) reasons.push('Visibility is in a useful misty-landscape range.');
    if (features.dewPointSpreadC <= 2) reasons.push('Temperature and dew point are close enough for fog formation.');
    if (features.windKph <= 8) reasons.push('Light winds should help shallow fog or mist hold together.');
    if (features.visibilityKm > 15) warnings.push('Air looks quite clear for a dedicated mist session.');
    if (features.windKph > 15) warnings.push('Breezier conditions may mix out shallow fog.');
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

const stormEvaluator: SessionEvaluator = {
  session: 'storm',
  requiredCapabilities: STORM_CAPABILITIES,
  evaluateHour(features) {
    const hardPass = features.cloudTotalPct >= 20 && features.cloudTotalPct <= 95;
    const showerBand = sweetSpotScore(features.precipProbabilityPct, 20, 70, 0, 100);
    const cloudStructure = sweetSpotScore(features.cloudTotalPct, 45, 85, 10, 100);
    const capeBoost = features.capeJkg != null ? sweetSpotScore(features.capeJkg, 1200, 3500, 100, 5000) : 0;
    const lightningBoost = features.lightningRisk != null ? clamp(features.lightningRisk) : 0;
    const lowAngleBoost = features.isGolden || features.isBlue ? 16 : 0;
    const windPenalty = features.windKph > 45 ? 18 : features.windKph > 30 ? 8 : 0;
    const azimuthEdgeLightBoost = (features.isGolden || features.isBlue) && features.clearPathBonusPts != null
      ? features.clearPathBonusPts * 2
      : 0;
    const azimuthPenalty = (features.isGolden || features.isBlue) && features.azimuthOcclusionRiskPct != null
      ? features.azimuthOcclusionRiskPct > 70 ? 10 : features.azimuthOcclusionRiskPct > 55 ? 5 : 0
      : 0;
    const spread = spreadVolatility(features);
    const volatilityBonus = stormVolatilityBonus(spread);
    const score =
      (features.dramaScore * 0.45)
      + (features.crepuscularScore * 0.15)
      + (showerBand * 0.15)
      + (cloudStructure * 0.1)
      + (capeBoost * 0.1)
      + (lightningBoost * 0.05)
      + lowAngleBoost
      + azimuthEdgeLightBoost
      + volatilityBonus
      - windPenalty
      - azimuthPenalty;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (features.dramaScore >= 60) reasons.push('Cloud structure and illumination already look storm-friendly.');
    if (showerBand >= 60) reasons.push('Showery conditions could support rain shafts or fast-changing breaks.');
    if (features.isGolden || features.isBlue) reasons.push('Low-angle light improves the odds of rays and edge lighting.');
    if ((features.azimuthOcclusionRiskPct ?? 100) < 30 && (features.isGolden || features.isBlue)) reasons.push('The sun-side gap looks open enough for edge-lit breaks.');
    if ((features.capeJkg ?? 0) >= 1500) reasons.push('Convective energy is elevated enough for more dramatic development.');
    if (features.cloudTotalPct < 30) warnings.push('There may not be enough storm structure yet.');
    if (features.cloudTotalPct > 90) warnings.push('Dense overcast could flatten the scene before breaks appear.');
    if ((features.azimuthOcclusionRiskPct ?? 0) > 65 && (features.isGolden || features.isBlue)) warnings.push('Blocked sun-side cloud may limit edge-lighting and ray potential.');
    if (features.windKph > 35) warnings.push('Strong winds may make shooting awkward and reduce stability.');
    if ((features.lightningRisk ?? 0) >= 50) warnings.push('Elevated lightning risk warrants a safety-first setup.');

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

const longExposureEvaluator: SessionEvaluator = {
  session: 'long-exposure',
  requiredCapabilities: LONG_EXPOSURE_CAPABILITIES,
  evaluateHour(features) {
    const hardPass = features.windKph <= 30 && features.gustKph <= 45;
    const windStability = sweetSpotScore(features.windKph, 0, 8, 0, 30);
    const gustStability = sweetSpotScore(features.gustKph, 0, 15, 0, 45);
    const cloudInterest = sweetSpotScore(features.cloudTotalPct, 30, 80, 0, 100);
    const atmosphericMood = clamp(
      (features.mistScore >= 20 ? Math.min(features.mistScore, 80) : 0)
      + (features.humidityPct >= 75 ? Math.round((features.humidityPct - 75) * 1.2) : 0));
    const lowAngleBoost = features.isGolden || features.isBlue ? 14 : 0;
    const hazeSweetSpot = sweetSpotScore(features.aerosolOpticalDepth, 0.06, 0.2, 0.01, 0.4);
    const visibilityRange = sweetSpotScore(features.visibilityKm, 2, 18, 0.3, 40);
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
      - windPenalty
      - gustPenalty
      - rainPenalty
      - uncertaintyPenalty;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (windStability >= 80) reasons.push('Calm winds are ideal for tripod stability and smooth exposures.');
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

const BUILT_IN_SESSION_EVALUATORS: SessionEvaluator[] = [goldenHourEvaluator, astroEvaluator, mistEvaluator, stormEvaluator, longExposureEvaluator];

export function getBuiltInSessionEvaluators(): SessionEvaluator[] {
  return [...BUILT_IN_SESSION_EVALUATORS];
}

export function getSessionEvaluator(session: SessionId): SessionEvaluator | undefined {
  return BUILT_IN_SESSION_EVALUATORS.find(evaluator => evaluator.session === session);
}

export function evaluateSessionFeatures(session: SessionId, features: DerivedHourFeatures): SessionScore {
  const evaluator = getSessionEvaluator(session);
  if (!evaluator) {
    throw new Error(`Unknown session evaluator: ${session}`);
  }
  return evaluator.evaluateHour(features);
}

export function evaluateBuiltInSessions(features: DerivedHourFeatures): SessionScore[] {
  return BUILT_IN_SESSION_EVALUATORS
    .map(evaluator => evaluator.evaluateHour(features))
    .sort((a, b) => b.score - a.score);
}

export function selectBestSessionScore(scores: SessionScore[]): SessionScore | null {
  return scores.reduce<SessionScore | null>((best, score) => {
    if (!best) return score;
    return score.score > best.score ? score : best;
  }, null);
}

export function selectBestBuiltInSession(features: DerivedHourFeatures): SessionScore | null {
  return selectBestSessionScore(evaluateBuiltInSessions(features));
}

export function selectBestSessionAcrossHours(hours: DerivedHourFeatures[]): SessionHourSelection | null {
  return hours.reduce<SessionHourSelection | null>((best, hour) => {
    const sessionScore = selectBestBuiltInSession(hour);
    if (!sessionScore) return best;
    const candidate: SessionHourSelection = { ...sessionScore, hourLabel: hour.hourLabel };
    if (!best) return candidate;
    return candidate.score > best.score ? candidate : best;
  }, null);
}

export function summarizeSessionRecommendations(hours: DerivedHourFeatures[]): SessionRecommendationSummary {
  const bestBySession = new Map<SessionId, SessionRecommendation>();

  for (const hour of hours) {
    for (const score of evaluateBuiltInSessions(hour)) {
      const candidate: SessionRecommendation = { ...score, hourLabel: hour.hourLabel };
      const current = bestBySession.get(score.session);
      if (!current || candidate.score > current.score) {
        bestBySession.set(score.session, candidate);
      }
    }
  }

  const bySession = [...bestBySession.values()].sort((a, b) => b.score - a.score);
  return {
    primary: bySession[0] ?? null,
    runnerUps: bySession.slice(1),
    bySession,
    hoursAnalyzed: hours.length,
  };
}
