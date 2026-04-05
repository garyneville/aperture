import { getMoonMetrics, moonScoreAdjustment, moonState } from '../../../lib/astro.js';
import { astroAodPenalty } from '../../../lib/utils.js';
import { serializeDebugPayload, upsertDebugPayloadSnapshot } from '../../../lib/debug-payload.js';
import { evaluateBuiltInSessions } from '../sessions/index.js';
import { deriveHourFeatures, type DerivedHourFeatureInput } from '../features/derive-hour-features.js';
import { emptyDebugContext, type DebugContext } from '../../../lib/debug-context.js';
import type { DaySummary, ScoredHour } from '../contracts.js';

interface EnsEntry { mean: number; stdDev: number }

function debugConfidenceLabel(confidence: string | null | undefined): string | null {
  if (!confidence || confidence === 'unknown') return confidence ?? null;
  if (confidence === 'medium') return 'Fair';
  if (confidence === 'high') return 'High';
  if (confidence === 'low') return 'Low';
  return confidence;
}

function toFeatureInputFromScoredHour(hour: ScoredHour, ensemble?: EnsEntry | null): DerivedHourFeatureInput {
  return {
    hourLabel: hour.hour,
    overallScore: hour.score,
    dramaScore: hour.drama,
    clarityScore: hour.clarity,
    mistScore: hour.mist,
    astroScore: hour.astro,
    cloudLowPct: hour.cl,
    cloudMidPct: hour.cm,
    cloudHighPct: hour.ch,
    cloudTotalPct: hour.ct,
    visibilityKm: hour.visK,
    aerosolOpticalDepth: hour.aod,
    precipProbabilityPct: hour.pp,
    humidityPct: hour.hum,
    temperatureC: hour.tmp,
    dewPointC: hour.dew,
    windKph: hour.wind,
    gustKph: hour.gusts,
    windDirectionDeg: hour.windDir,
    moonIlluminationPct: hour.moon,
    moonAltitudeDeg: hour.moonAltDeg ?? null,
    solarAltitudeDeg: hour.solarAltDeg ?? null,
    isNight: hour.isNight,
    isGolden: hour.isGolden,
    isBlue: hour.isBlue,
    tags: hour.tags,
    azimuthOcclusionRiskPct: hour.azimuthRisk,
    azimuthLowCloudRiskPct: null,
    clearPathBonusPts: null,
    boundaryLayerHeightM: hour.boundaryLayerHeightM ?? null,
    horizonGapPct: hour.horizonGapPct ?? null,
    ensembleCloudStdDevPct: ensemble ? Math.round(ensemble.stdDev) : null,
    ensembleCloudMeanPct: ensemble ? Math.round(ensemble.mean) : null,
    directRadiationWm2: hour.directRadiationWm2 ?? null,
    diffuseRadiationWm2: hour.diffuseRadiationWm2 ?? null,
    soilTemperature0cmC: hour.soilTemperature0cmC ?? null,
  };
}

export interface BuildDebugContextParams {
  scoreInput: unknown;
  todayDay: DaySummary | undefined;
  todayHours: ScoredHour[];
  ensIdx: Record<string, EnsEntry>;
  lat: number;
  lon: number;
  featureInputsByTs: Record<string, DerivedHourFeatureInput>;
}

export interface BuildDebugContextResult {
  debugContext: DebugContext;
  todayFeatures: ReturnType<typeof deriveHourFeatures>[];
}

export function buildDebugContext(p: BuildDebugContextParams): BuildDebugContextResult {
  const debugContext = emptyDebugContext();
  upsertDebugPayloadSnapshot(debugContext, {
    label: 'Score input payload',
    ...serializeDebugPayload(p.scoreInput),
  });

  if (p.todayDay) {
    debugContext.scores = {
      am: p.todayDay.amScore,
      pm: p.todayDay.pmScore,
      astro: p.todayDay.astroScore,
      overall: p.todayDay.headlineScore ?? p.todayDay.photoScore,
      certainty: debugConfidenceLabel(p.todayDay.confidence),
      certaintySpread: p.todayDay.confidenceStdDev ?? null,
      astroConfidence: debugConfidenceLabel(p.todayDay.astroConfidence),
      astroConfidenceStdDev: p.todayDay.astroConfidenceStdDev ?? null,
    };
  }

  const todayFeatures = p.todayHours.map(hour => {
    const fallback = toFeatureInputFromScoredHour(hour, p.ensIdx[hour.ts] || null);
    const captured = p.featureInputsByTs[hour.ts];
    return deriveHourFeatures(captured ? { ...fallback, ...captured } : fallback);
  });

  debugContext.hourlyScoring = p.todayHours.map((hour, index) => {
    const moonMetrics = getMoonMetrics(Date.parse(hour.ts), p.lat, p.lon);
    const features = todayFeatures[index]!;
    const sessionScores = evaluateBuiltInSessions(features).map(score => ({
      session: score.session,
      score: score.score,
      hardPass: score.hardPass,
      confidence: score.confidence,
      volatility: score.volatility,
      reasons: score.reasons,
      warnings: score.warnings,
    }));
    return {
      hour: hour.hour,
      timestamp: hour.ts,
      final: hour.score,
      cloud: hour.ct,
      visK: hour.visK,
      aod: hour.aod,
      moonAdjustment: moonScoreAdjustment(moonMetrics),
      moonState: moonState(moonMetrics),
      aodPenalty: astroAodPenalty(hour.aod),
      astroScore: hour.astro,
      drama: hour.drama,
      clarity: hour.clarity,
      mist: hour.mist,
      moon: {
        altitudeDeg: Math.round(moonMetrics.altitudeDeg * 10) / 10,
        illuminationPct: Math.round(moonMetrics.illumination * 100),
        azimuthDeg: moonMetrics.isUp ? Math.round(moonMetrics.azimuthDeg) : null,
        isUp: moonMetrics.isUp,
      },
      sessionScores,
      tags: hour.tags,
    };
  });

  return { debugContext, todayFeatures };
}
