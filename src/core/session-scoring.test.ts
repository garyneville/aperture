import { describe, expect, it } from 'vitest';
import { deriveHourFeatures, type DerivedHourFeatureInput } from './features/derive-hour-features.js';
import {
  evaluateBuiltInSessions,
  evaluateSessionFeatures,
  getBuiltInSessionEvaluators,
  selectBestBuiltInSession,
  selectBestSessionAcrossHours,
  summarizeSessionRecommendations,
} from './session-scoring.js';

function makeHour(overrides: Partial<DerivedHourFeatureInput> = {}): DerivedHourFeatureInput {
  return {
    hourLabel: '19:00',
    overallScore: 72,
    dramaScore: 78,
    clarityScore: 68,
    mistScore: 20,
    astroScore: 14,
    crepuscularScore: 61,
    cloudLowPct: 20,
    cloudMidPct: 30,
    cloudHighPct: 18,
    cloudTotalPct: 52,
    visibilityKm: 24,
    aerosolOpticalDepth: 0.12,
    precipProbabilityPct: 8,
    humidityPct: 66,
    temperatureC: 9,
    dewPointC: 4,
    windKph: 11,
    gustKph: 18,
    moonIlluminationPct: 12,
    isGolden: true,
    isBlue: false,
    isNight: false,
    tags: ['dramatic sky', 'golden hour'],
    ...overrides,
  };
}

describe('session scoring foundation', () => {
  it('exposes built-in evaluators for the first two session types', () => {
    expect(getBuiltInSessionEvaluators().map(evaluator => evaluator.session)).toEqual(['golden-hour', 'astro', 'mist', 'storm']);
  });

  it('works from the shared derived-feature seam', () => {
    const features = deriveHourFeatures(makeHour());

    expect(features.hourLabel).toBe('19:00');
    expect(features.cloudTotalPct).toBe(52);
    expect(features.transparencyScore).toBeGreaterThan(0);
    expect(features.isGolden).toBe(true);
  });

  it('scores a golden-hour session with a hard pass during low-angle light', () => {
    const result = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour()));

    expect(result.hardPass).toBe(true);
    expect(result.score).toBeGreaterThan(60);
    expect(result.reasons).toContain('Broken cloud cover can catch low-angle light well.');
    expect(result.requiredCapabilities).toContain('sun-geometry');
  });

  it('uses azimuth light-path risk to refine golden-hour scoring', () => {
    const clearPath = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({
      azimuthOcclusionRiskPct: 18,
      clearPathBonusPts: 8,
    })));
    const blockedPath = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({
      azimuthOcclusionRiskPct: 78,
      clearPathBonusPts: -10,
    })));

    expect(clearPath.score).toBeGreaterThan(blockedPath.score);
    expect(clearPath.reasons).toContain('Low-angle light path looks relatively clear.');
    expect(blockedPath.warnings).toContain('Low-angle light may be blocked near the horizon.');
  });

  it('fails astro hard gates during daylight hours', () => {
    const result = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({ isNight: false, astroScore: 55, cloudTotalPct: 5 })));

    expect(result.hardPass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.warnings).toContain('This hour is not inside a darkness window.');
  });

  it('ranks astro first for a dark, clear hour', () => {
    const sessions = evaluateBuiltInSessions(deriveHourFeatures(makeHour({
      isGolden: false,
      isNight: true,
      astroScore: 86,
      cloudTotalPct: 9,
      cloudLowPct: 4,
      cloudMidPct: 5,
      cloudHighPct: 6,
      visibilityKm: 30,
      humidityPct: 58,
      aerosolOpticalDepth: 0.06,
      moonIlluminationPct: 8,
      tags: ['astrophotography'],
    })));

    expect(sessions[0]?.session).toBe('astro');
    expect(sessions[0]?.hardPass).toBe(true);
    expect(sessions[0]?.confidence).toBe('high');
  });

  it('treats astro cloud spread as a confidence and score penalty', () => {
    const stable = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isGolden: false,
      isNight: true,
      astroScore: 86,
      cloudTotalPct: 9,
      cloudLowPct: 4,
      cloudMidPct: 5,
      cloudHighPct: 6,
      visibilityKm: 30,
      humidityPct: 58,
      aerosolOpticalDepth: 0.06,
      moonIlluminationPct: 8,
      ensembleCloudStdDevPct: 4,
    })));
    const volatile = evaluateSessionFeatures('astro', deriveHourFeatures(makeHour({
      isGolden: false,
      isNight: true,
      astroScore: 86,
      cloudTotalPct: 9,
      cloudLowPct: 4,
      cloudMidPct: 5,
      cloudHighPct: 6,
      visibilityKm: 30,
      humidityPct: 58,
      aerosolOpticalDepth: 0.06,
      moonIlluminationPct: 8,
      ensembleCloudStdDevPct: 22,
    })));

    expect(stable.confidence).toBe('high');
    expect(volatile.confidence).toBe('low');
    expect(volatile.volatility).toBe(22);
    expect(volatile.score).toBeLessThan(stable.score);
  });

  it('can surface mist as the best-fit session for a fog-prone hour', () => {
    const sessions = evaluateBuiltInSessions(deriveHourFeatures(makeHour({
      overallScore: 48,
      dramaScore: 25,
      clarityScore: 18,
      mistScore: 86,
      astroScore: 0,
      crepuscularScore: 12,
      cloudTotalPct: 92,
      visibilityKm: 4.5,
      aerosolOpticalDepth: 0.08,
      windKph: 4,
      gustKph: 7,
      temperatureC: 6,
      humidityPct: 95,
      dewPointC: 5,
      precipProbabilityPct: 18,
      isGolden: false,
      isBlue: false,
      isNight: false,
      tags: ['mist', 'atmospheric'],
    })));

    expect(sessions[0]?.session).toBe('mist');
    expect(sessions[0]?.hardPass).toBe(true);
    expect(sessions[0]?.reasons).toContain('Visibility is in a useful misty-landscape range.');
  });

  it('can surface storm as the best-fit session for a dramatic showery setup', () => {
    const result = selectBestBuiltInSession(deriveHourFeatures(makeHour({
      overallScore: 64,
      dramaScore: 88,
      clarityScore: 36,
      mistScore: 10,
      astroScore: 0,
      crepuscularScore: 58,
      cloudTotalPct: 74,
      visibilityKm: 16,
      aerosolOpticalDepth: 0.14,
      precipProbabilityPct: 52,
      humidityPct: 82,
      windKph: 22,
      gustKph: 34,
      isGolden: true,
      isBlue: false,
      isNight: false,
      azimuthOcclusionRiskPct: 20,
      clearPathBonusPts: 8,
      capeJkg: 1800,
      lightningRisk: 28,
      tags: ['dramatic sky', 'crepuscular rays'],
    })));

    expect(result?.session).toBe('storm');
    expect(result?.hardPass).toBe(true);
    expect(result?.reasons).toContain('Cloud structure and illumination already look storm-friendly.');
    expect(result?.reasons).toContain('The sun-side gap looks open enough for edge-lit breaks.');
  });

  it('treats storm spread as volatility instead of a flat negative', () => {
    const stable = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      overallScore: 52,
      dramaScore: 72,
      clarityScore: 34,
      mistScore: 10,
      astroScore: 0,
      crepuscularScore: 36,
      cloudTotalPct: 74,
      visibilityKm: 16,
      aerosolOpticalDepth: 0.14,
      precipProbabilityPct: 52,
      humidityPct: 82,
      windKph: 22,
      gustKph: 34,
      isGolden: true,
      isBlue: false,
      isNight: false,
      capeJkg: 1800,
      lightningRisk: 28,
      ensembleCloudStdDevPct: 4,
      tags: ['dramatic sky', 'crepuscular rays'],
    })));
    const volatile = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      overallScore: 52,
      dramaScore: 72,
      clarityScore: 34,
      mistScore: 10,
      astroScore: 0,
      crepuscularScore: 36,
      cloudTotalPct: 74,
      visibilityKm: 16,
      aerosolOpticalDepth: 0.14,
      precipProbabilityPct: 52,
      humidityPct: 82,
      windKph: 22,
      gustKph: 34,
      isGolden: true,
      isBlue: false,
      isNight: false,
      capeJkg: 1800,
      lightningRisk: 28,
      ensembleCloudStdDevPct: 18,
      tags: ['dramatic sky', 'crepuscular rays'],
    })));

    expect(stable.confidence).toBe('high');
    expect(volatile.confidence).toBe('medium');
    expect(volatile.volatility).toBe(18);
    expect(volatile.score).toBeGreaterThan(stable.score);
  });

  it('can select the strongest session across multiple candidate hours', () => {
    const result = selectBestSessionAcrossHours([
      deriveHourFeatures(makeHour({
        hourLabel: '06:00',
        overallScore: 42,
        dramaScore: 28,
        clarityScore: 18,
        mistScore: 80,
        visibilityKm: 4,
        humidityPct: 95,
        temperatureC: 5,
        dewPointC: 4,
        windKph: 3,
        isGolden: false,
      })),
      deriveHourFeatures(makeHour({
        hourLabel: '19:00',
        overallScore: 64,
        dramaScore: 88,
        clarityScore: 36,
        mistScore: 10,
        astroScore: 0,
        crepuscularScore: 58,
        cloudTotalPct: 74,
        visibilityKm: 16,
        aerosolOpticalDepth: 0.14,
        precipProbabilityPct: 52,
        humidityPct: 82,
        windKph: 22,
        gustKph: 34,
        isGolden: true,
        isBlue: false,
        isNight: false,
        capeJkg: 1800,
        lightningRisk: 28,
        tags: ['dramatic sky', 'crepuscular rays'],
      })),
    ]);

    expect(result?.session).toBe('storm');
    expect(result?.hourLabel).toBe('19:00');
  });

  it('golden-hour bell-curve: broken cloud scores higher than clear sky or overcast', () => {
    const broken = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ cloudTotalPct: 50, cloudLowPct: 15, cloudMidPct: 20, cloudHighPct: 15 })));
    const clear  = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ cloudTotalPct: 8, cloudLowPct: 3, cloudMidPct: 3, cloudHighPct: 2 })));
    const overcast = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ cloudTotalPct: 95, cloudLowPct: 40, cloudMidPct: 30, cloudHighPct: 25 })));

    expect(broken.score).toBeGreaterThan(clear.score);
    expect(broken.score).toBeGreaterThan(overcast.score);
    expect(broken.reasons).toContain('Broken cloud cover can catch low-angle light well.');
    expect(clear.warnings).toContain('Clear sky may lack the cloud texture needed for dramatic colour.');
    expect(overcast.warnings).toContain('Featureless overcast may flatten the light.');
  });

  it('golden-hour azimuth penalty scales smoothly with occlusion risk', () => {
    const low    = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ azimuthOcclusionRiskPct: 20, clearPathBonusPts: 4 })));
    const medium = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ azimuthOcclusionRiskPct: 50, clearPathBonusPts: 0 })));
    const high   = evaluateSessionFeatures('golden-hour', deriveHourFeatures(makeHour({ azimuthOcclusionRiskPct: 80, clearPathBonusPts: -5 })));

    expect(low.score).toBeGreaterThan(medium.score);
    expect(medium.score).toBeGreaterThan(high.score);
  });

  it('storm bell-curve: moderate precip scores higher than dry or heavy rain', () => {
    const moderate = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 75, crepuscularScore: 40, cloudTotalPct: 65, precipProbabilityPct: 45,
      isGolden: true, windKph: 15,
    })));
    const dry = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 75, crepuscularScore: 40, cloudTotalPct: 65, precipProbabilityPct: 5,
      isGolden: true, windKph: 15,
    })));
    const heavy = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 75, crepuscularScore: 40, cloudTotalPct: 65, precipProbabilityPct: 95,
      isGolden: true, windKph: 15,
    })));

    expect(moderate.score).toBeGreaterThan(dry.score);
    expect(moderate.score).toBeGreaterThan(heavy.score);
    expect(moderate.reasons).toContain('Showery conditions could support rain shafts or fast-changing breaks.');
  });

  it('storm drama-cloud synergy peaks in partial cloud, not in full overcast', () => {
    const partial = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 82, cloudTotalPct: 60, precipProbabilityPct: 45,
      isGolden: true, windKph: 18, crepuscularScore: 44,
    })));
    const overcast = evaluateSessionFeatures('storm', deriveHourFeatures(makeHour({
      dramaScore: 82, cloudTotalPct: 92, precipProbabilityPct: 45,
      isGolden: true, windKph: 18, crepuscularScore: 44,
    })));

    expect(partial.score).toBeGreaterThan(overcast.score);
    expect(partial.reasons).toContain('Partial cloud should let dramatic breaks develop rather than flatten the scene.');
    expect(overcast.warnings).toContain('Dense overcast could flatten the scene before breaks appear.');
  });

  it('summarizes per-session recommendations without duplicate session winners', () => {
    const summary = summarizeSessionRecommendations([
      deriveHourFeatures(makeHour({
        hourLabel: '06:00',
        overallScore: 42,
        dramaScore: 28,
        clarityScore: 18,
        mistScore: 80,
        visibilityKm: 4,
        humidityPct: 95,
        temperatureC: 5,
        dewPointC: 4,
        windKph: 3,
        isGolden: false,
      })),
      deriveHourFeatures(makeHour({
        hourLabel: '19:00',
        overallScore: 64,
        dramaScore: 88,
        clarityScore: 36,
        mistScore: 10,
        astroScore: 0,
        crepuscularScore: 58,
        cloudTotalPct: 74,
        visibilityKm: 16,
        aerosolOpticalDepth: 0.14,
        precipProbabilityPct: 52,
        humidityPct: 82,
        windKph: 22,
        gustKph: 34,
        isGolden: true,
        isBlue: false,
        isNight: false,
        azimuthOcclusionRiskPct: 20,
        clearPathBonusPts: 8,
        capeJkg: 1800,
        lightningRisk: 28,
        tags: ['dramatic sky', 'crepuscular rays'],
      })),
    ]);

    expect(summary.primary?.session).toBe('storm');
    expect(summary.primary?.hourLabel).toBe('19:00');
    expect(summary.hoursAnalyzed).toBe(2);
    expect(summary.bySession.map(entry => entry.session)).toEqual(['storm', 'mist', 'golden-hour', 'astro']);
    expect(summary.runnerUps[0]?.session).toBe('mist');
  });
});
