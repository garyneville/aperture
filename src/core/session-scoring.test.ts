import { describe, expect, it } from 'vitest';
import { deriveHourFeatures, type DerivedHourFeatureInput } from './features/derive-hour-features.js';
import {
  evaluateBuiltInSessions,
  evaluateSessionFeatures,
  getBuiltInSessionEvaluators,
  selectBestBuiltInSession,
  selectBestSessionAcrossHours,
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
      capeJkg: 1800,
      lightningRisk: 28,
      tags: ['dramatic sky', 'crepuscular rays'],
    })));

    expect(result?.session).toBe('storm');
    expect(result?.hardPass).toBe(true);
    expect(result?.reasons).toContain('Cloud structure and illumination already look storm-friendly.');
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
});
