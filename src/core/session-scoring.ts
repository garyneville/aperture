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

// ── Wind direction helpers ─────────────────────────────────────────────────

/** Compass label for a bearing (0-360). */
function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

/**
 * How well aligned is the wind with the sun azimuth?
 * Returns 0-100: 100 = wind blows directly from sun-side (into your back),
 * 0 = wind blows from behind you toward the sun.
 *
 * Useful for storm edge-lighting (crosswind better) and reflection
 * disruption (headwind/tailwind gentler on still water).
 */
function windSunCrossAngle(windDeg: number | null, sunAzimuthPhase: 'sunrise' | 'sunset' | null): number | null {
  if (windDeg == null || sunAzimuthPhase == null) return null;
  // Rough east/west proxy: sunrise ~90°, sunset ~270°
  const sunAz = sunAzimuthPhase === 'sunrise' ? 90 : 270;
  const diff = Math.abs(((windDeg - sunAz + 540) % 360) - 180);
  // 90° diff = perfect crosswind
  return Math.round(sweetSpotScore(diff, 60, 120, 0, 180));
}

/**
 * Score how sheltered still water is from wind disruption.
 * Low wind + wind coming from a direction that doesn't rake across open water
 * is best. Simplified: just penalise higher wind harder and give a gentle
 * bonus when the wind is light and not gusting.
 */
function reflectionWindScore(windKph: number, gustKph: number): number {
  const calmScore = sweetSpotScore(windKph, 0, 4, 0, 14);
  const gustScore = sweetSpotScore(gustKph, 0, 8, 0, 20);
  return Math.round((calmScore * 0.65) + (gustScore * 0.35));
}

/**
 * Does the wind favour mist persistence?
 * Calm wind keeps fog in place; moderate wind mixes it out.
 * A sheltered direction (qualitative — simplified to magnitude only for now)
 * is handled by the existing calm-wind score.
 */
function mistWindDirectionNote(windKph: number, windDeg: number | null): string | null {
  if (windDeg == null) return null;
  if (windKph <= 4) return `Light ${compassLabel(windDeg)} wind helps mist hold.`;
  if (windKph <= 10) return `Gentle ${compassLabel(windDeg)} breeze — mist may thin on exposed ground.`;
  return null;
}

/**
 * Wind context for wildlife: calmer is better (noise, scent carry, and subject stress).
 * Downwind approach is a field skill, but strong wind from any direction is a negative.
 */
function wildlifeWindNote(windKph: number, gustKph: number, windDeg: number | null): string | null {
  if (windDeg == null) return null;
  const dir = compassLabel(windDeg);
  if (windKph <= 6 && gustKph <= 12) return `Very light ${dir} wind — ideal for quiet approach and stable long-lens work.`;
  if (windKph <= 12) return `Light ${dir} wind — plan your approach upwind of the subject.`;
  if (windKph <= 20) return `Moderate ${dir} wind — subjects may shelter on the lee side; expect restless perches.`;
  return `Strong ${dir} wind — challenging conditions for wildlife; subjects may hunker down.`;
}

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

function bellCurve(value: number, center: number, width: number): number {
  const z = (value - center) / width;
  return clamp(Math.round(100 * Math.exp(-0.5 * z * z)));
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

function mistVisibilitySweetSpot(visibilityKm: number): number {
  const sweetSpot = sweetSpotScore(visibilityKm, 1.2, 6, 0.4, 14);
  const denseFogPenalty = visibilityKm < 0.5 ? 28 : visibilityKm < 0.8 ? 14 : 0;
  return clamp(sweetSpot - denseFogPenalty);
}

function mistDewPointAlignmentScore(dewPointSpreadC: number): number {
  return sweetSpotScore(dewPointSpreadC, 0, 1.2, -0.1, 5.5);
}

function mistHumiditySupportScore(humidityPct: number): number {
  return sweetSpotScore(humidityPct, 92, 100, 75, 101);
}

function mistWindPersistenceScore(windKph: number): number {
  return sweetSpotScore(windKph, 0, 6, -1, 25);
}

function mistBoundaryLayerSupportScore(boundaryLayerHeightM: number | null | undefined): number | null {
  if (boundaryLayerHeightM == null) return null;
  return sweetSpotScore(boundaryLayerHeightM, 0, 350, -1, 1800);
}

function stormVolatilityBonus(spread: number | null): number {
  if (spread == null) return 0;
  return Math.round(sweetSpotScore(spread, 8, 24, 0, 40) * 0.08);
}

function urbanUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 10) return 0;
  return clamp(Math.round((spread - 10) * 0.5), 0, 12);
}

function longExposureUncertaintyPenalty(spread: number | null): number {
  if (spread == null || spread <= 10) return 0;
  return clamp(Math.round((spread - 10) * 0.6), 0, 14);
}

function cloudOpticalWindowScore(features: DerivedHourFeatures): number {
  return sweetSpotScore(features.cloudOpticalThicknessPct, 18, 52, 0, 90);
}

function wildlifeConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = hardPass
    && features.windKph <= 10
    && features.gustKph <= 18
    && features.visibilityKm >= 10
    && (features.isGolden || features.isBlue || (features.cloudTotalPct >= 45 && features.cloudTotalPct <= 80))
    && features.precipProbabilityPct <= 35
    && (features.lightningRisk ?? 0) < 20
    && (features.capeJkg ?? 0) < 800;
  if (!hardPass) return 'low';
  if (spread == null) return base ? 'medium' : 'low';
  return base && spread < 12 ? 'medium' : 'low';
}

function goldenHourConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = features.cloudTotalPct >= 25
    && features.cloudTotalPct <= 75
    && features.visibilityKm >= 15
    && (features.hazeTrapRisk == null || features.hazeTrapRisk <= 55);
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 10, 24)
    : confidenceFromSpread(spread, hardPass, 8, 18);
}

function astroConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = features.cloudTotalPct <= 15
    && features.moonIlluminationPct <= 30
    && features.transparencyScore >= 65
    && (features.hazeTrapRisk == null || features.hazeTrapRisk <= 55);
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 6, 14)
    : confidenceFromSpread(spread, hardPass, 5, 10);
}

function mistConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const base = features.dewPointSpreadC <= 1.5
    && features.humidityPct >= 92
    && features.windKph <= 8
    && features.visibilityKm >= 0.8
    && features.visibilityKm <= 8
    && (features.boundaryLayerHeightM == null || features.boundaryLayerHeightM <= 800);
  if (!hardPass || features.visibilityKm < 0.8) return 'low';
  if (spread == null) return base ? 'high' : 'medium';
  return base
    ? confidenceFromSpread(spread, hardPass, 8, 16)
    : confidenceFromSpread(spread, hardPass, 6, 12);
}

function urbanConfidence(features: DerivedHourFeatures, hardPass: boolean): SessionConfidence {
  const spread = spreadVolatility(features);
  const hasWetStreet = features.precipProbabilityPct >= 40
    || (features.surfaceWetnessScore != null && features.surfaceWetnessScore >= 60);
  const base = hasWetStreet && (features.isBlue || features.isNight) && features.windKph <= 10;
  if (spread == null) return base && hardPass ? 'high' : hardPass ? 'medium' : 'low';
  return base
    ? confidenceFromSpread(spread, hardPass, 10, 20)
    : confidenceFromSpread(spread, hardPass, 8, 16);
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

const URBAN_CAPABILITIES: ScoringCapability[] = [
  'precipitation',
  'visibility',
  'humidity',
  'wind',
  'aerosols',
  'surface-wetness',
];

const LONG_EXPOSURE_CAPABILITIES: ScoringCapability[] = [
  'wind',
  'cloud-stratification',
  'visibility',
  'humidity',
  'sun-geometry',
];

const WILDLIFE_CAPABILITIES: ScoringCapability[] = [
  'sun-geometry',
  'cloud-stratification',
  'visibility',
  'wind',
  'precipitation',
];

const goldenHourEvaluator: SessionEvaluator = {
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

const astroEvaluator: SessionEvaluator = {
  session: 'astro',
  requiredCapabilities: ASTRO_CAPABILITIES,
  evaluateHour(features) {
    // HARD GATES – tighter cloud cap and a transparency floor
    const hardPass = features.isNight
      && features.cloudTotalPct <= 60
      && features.transparencyScore >= 15;

    // NON-LINEAR CLOUD PENALTY – quadratic ramp starting at 10 %
    const effectiveCloudOpacity = Math.round((features.cloudTotalPct * 0.65) + (features.cloudOpticalThicknessPct * 0.35));
    const cloudFrac = clamp(effectiveCloudOpacity - 10, 0, 50) / 50;   // 0-1 above 10 %
    const cloudPenalty = Math.round(cloudFrac * cloudFrac * 30);         // 0-30

    // NON-LINEAR MOON WASHOUT PENALTY – cubic ramp past 25 %
    const moonFrac = clamp(features.moonIlluminationPct - 25, 0, 75) / 75;
    const moonPenalty = Math.round(moonFrac * moonFrac * moonFrac * 35); // 0-35

    // NON-LINEAR TRANSPARENCY BONUS – sweet-spot curve (best between 65-95)
    const transparencySweetSpot = sweetSpotScore(features.transparencyScore, 65, 95, 20, 100);
    const thinVeilBonus = clamp(Math.round(features.highCloudTranslucencyScore * 0.05), 0, 5);
    const lowCloudPenalty = features.lowCloudBlockingScore >= 35
      ? clamp(Math.round((features.lowCloudBlockingScore - 35) * 0.18), 0, 10)
      : 0;

    const spread = spreadVolatility(features);
    const uncertaintyPenalty = astroUncertaintyPenalty(spread);

    const score =
      (features.astroScore * 0.55)
      + (transparencySweetSpot * 0.2)
      + (features.transparencyScore * 0.1)
      + (Math.max(0, 100 - features.moonIlluminationPct) * 0.15)
      + thinVeilBonus
      - moonPenalty
      - cloudPenalty
      - lowCloudPenalty
      - uncertaintyPenalty;

    const reasons: string[] = [];
    const warnings: string[] = [];

    if (features.cloudTotalPct <= 15) reasons.push('Cloud cover is excellent for deep-sky imaging.');
    else if (features.cloudTotalPct <= 25) reasons.push('Cloud cover is low enough for a plausible dark-sky run.');
    if (features.moonIlluminationPct <= 15) reasons.push('Near-new-moon darkness favours faint nebulae and galaxies.');
    else if (features.moonIlluminationPct <= 30) reasons.push('Moonlight should stay subdued for darker skies.');
    if (features.transparencyScore >= 75) reasons.push('Transparency looks strong for clean deep-sky contrast.');
    else if (features.transparencyScore >= 55) reasons.push('Current haze and humidity look workable for transparency.');
    if (features.highCloudTranslucencyScore >= 70 && features.cloudOpticalThicknessPct <= 35) reasons.push('Any remaining cloud looks like a thin veil rather than a solid deck.');
    if (!features.isNight) warnings.push('This hour is not inside a darkness window.');
    if (features.cloudTotalPct > 45) warnings.push('Cloud cover is approaching an astro deal-breaker.');
    else if (features.cloudTotalPct > 30) warnings.push('Moderate cloud may interrupt longer exposures.');
    if (features.lowCloudBlockingScore >= 30) warnings.push('Dense low cloud is a bigger risk than the raw cloud-cover total suggests.');
    if (features.moonIlluminationPct > 70) warnings.push('Bright moonlight will wash out all but the brightest targets.');
    else if (features.moonIlluminationPct > 45) warnings.push('Moonlight may wash out faint targets.');
    if (features.transparencyScore < 30) warnings.push('Poor transparency will limit deep-sky contrast.');
    if ((features.hazeTrapRisk ?? 0) >= 60) warnings.push('A shallow boundary layer may be trapping haze despite the cloud forecast.');

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

const stormEvaluator: SessionEvaluator = {
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
    const lowAngleBoost = features.isGolden || features.isBlue ? 16 : 0;
    const windPenalty = features.windKph > 45 ? 18 : features.windKph > 30 ? 8 : 0;
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

const longExposureEvaluator: SessionEvaluator = {
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

const urbanEvaluator: SessionEvaluator = {
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

const wildlifeEvaluator: SessionEvaluator = {
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

const BUILT_IN_SESSION_EVALUATORS: SessionEvaluator[] = [
  goldenHourEvaluator,
  astroEvaluator,
  mistEvaluator,
  stormEvaluator,
  longExposureEvaluator,
  urbanEvaluator,
  wildlifeEvaluator,
];

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
