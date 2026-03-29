import { describe, expect, it } from 'vitest';
import { deriveHourFeatures, type DerivedHourFeatureInput } from './derive-hour-features.js';

function makeInput(overrides: Partial<DerivedHourFeatureInput> = {}): DerivedHourFeatureInput {
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
    isNight: false,
    isGolden: true,
    isBlue: false,
    tags: ['dramatic sky', 'golden hour'],
    ...overrides,
  };
}

describe('deriveHourFeatures', () => {
  it('computes transparency and dew point spread from the explicit feature input', () => {
    const features = deriveHourFeatures(makeInput());

    expect(features.hourLabel).toBe('19:00');
    expect(features.dewPointSpreadC).toBe(5);
    expect(features.transparencyScore).toBeGreaterThan(0);
    expect(features.cloudTotalPct).toBe(52);
  });

  it('preserves optional capability-driven fields for future enrichments', () => {
    const features = deriveHourFeatures(makeInput({
      boundaryLayerHeightM: 220,
      horizonGapPct: 35,
      lightPollutionBortle: 4,
      lightningRisk: 12,
    }));

    expect(features.boundaryLayerHeightM).toBe(220);
    expect(features.horizonGapPct).toBe(35);
    expect(features.lightPollutionBortle).toBe(4);
    expect(features.lightningRisk).toBe(12);
  });
});
