import { clamp } from './utils.js';
import type { ScoringCapability } from '../types/capabilities.js';
import type {
  DerivedHourFeatures,
  SessionConfidence,
  SessionEvaluator,
  SessionId,
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

function goldenHourConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  if (!hardPass) return 'low';
  if (features.cloudTotalPct >= 25 && features.cloudTotalPct <= 75 && features.visibilityKm >= 15) {
    return 'high';
  }
  return 'medium';
}

function astroConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  if (!hardPass) return 'low';
  if (features.cloudTotalPct <= 15 && features.moonIlluminationPct <= 30 && features.transparencyScore >= 65) {
    return 'high';
  }
  return 'medium';
}

function mistConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  if (!hardPass) return 'low';
  if (features.dewPointSpreadC <= 1.5 && features.humidityPct >= 92 && features.windKph <= 8) {
    return 'high';
  }
  return 'medium';
}

function completeScore(
  session: SessionId,
  requiredCapabilities: ScoringCapability[],
  hardPass: boolean,
  score: number,
  confidence: SessionConfidence,
  reasons: string[],
  warnings: string[],
): SessionScore {
  return {
    session,
    score: hardPass ? clamp(Math.round(score)) : 0,
    hardPass,
    confidence,
    volatility: null,
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

const goldenHourEvaluator: SessionEvaluator = {
  session: 'golden-hour',
  requiredCapabilities: GOLDEN_HOUR_CAPABILITIES,
  evaluateHour(features) {
    const hardPass = features.isGolden || features.isBlue;
    const cloudCanvas = sweetSpotScore(features.cloudTotalPct, 35, 70, 5, 100);
    const hazeSweetSpot = sweetSpotScore(features.aerosolOpticalDepth, 0.08, 0.18, 0.02, 0.35);
    const windPenalty = features.windKph > 30 ? 12 : features.windKph > 20 ? 6 : 0;
    const visibilityPenalty = features.visibilityKm < 8 ? 18 : features.visibilityKm < 15 ? 8 : 0;
    const score =
      (features.overallScore * 0.35)
      + (features.dramaScore * 0.25)
      + (features.crepuscularScore * 0.15)
      + (cloudCanvas * 0.15)
      + (hazeSweetSpot * 0.1)
      - windPenalty
      - visibilityPenalty;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (cloudCanvas >= 70) reasons.push('Broken cloud cover can catch low-angle light well.');
    if (features.crepuscularScore >= 40) reasons.push('Crepuscular-ray potential is already elevated.');
    if (features.visibilityKm >= 18) reasons.push('Visibility should preserve depth and distant contrast.');
    if (features.cloudTotalPct >= 90) warnings.push('Featureless overcast may flatten the light.');
    if (features.visibilityKm < 10) warnings.push('Heavy haze could mute contrast despite good color.');
    if (features.windKph > 25) warnings.push('Wind may make long-lens or tripod work fussier.');
    if (!hardPass) warnings.push('This hour is outside the low-angle light window.');

    return completeScore(
      'golden-hour',
      GOLDEN_HOUR_CAPABILITIES,
      hardPass,
      score,
      goldenHourConfidence(features, hardPass),
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
    const score =
      (features.astroScore * 0.6)
      + (features.transparencyScore * 0.25)
      + (Math.max(0, 100 - features.moonIlluminationPct) * 0.15)
      - moonPenalty
      - cloudPenalty;
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
    const score =
      (features.mistScore * 0.45)
      + (visibilitySweetSpot * 0.2)
      + (dewPointAlignment * 0.15)
      + (features.humidityPct * 0.15)
      + ((100 - Math.min(features.clarityScore, 100)) * 0.05)
      - windPenalty
      - rainPenalty;
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
      reasons,
      warnings,
    );
  },
};

const BUILT_IN_SESSION_EVALUATORS: SessionEvaluator[] = [goldenHourEvaluator, astroEvaluator, mistEvaluator];

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
