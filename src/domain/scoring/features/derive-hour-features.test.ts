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
    windDirectionDeg: null,
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

  it('derives stronger trap and haze signals from a shallow moist boundary layer', () => {
    const trapped = deriveHourFeatures(makeInput({
      boundaryLayerHeightM: 220,
      humidityPct: 84,
      aerosolOpticalDepth: 0.12,
      visibilityKm: 20,
    }));
    const mixed = deriveHourFeatures(makeInput({
      boundaryLayerHeightM: 1600,
      humidityPct: 84,
      aerosolOpticalDepth: 0.12,
      visibilityKm: 20,
    }));

    expect(trapped.boundaryLayerTrapScore).toBeGreaterThan(mixed.boundaryLayerTrapScore ?? -1);
    expect(trapped.hazeTrapRisk).toBeGreaterThan(mixed.hazeTrapRisk ?? -1);
    expect(trapped.transparencyScore).toBeLessThan(mixed.transparencyScore);
  });

  it('distinguishes translucent upper cloud from dense low blocking cloud', () => {
    const translucent = deriveHourFeatures(makeInput({
      cloudTotalPct: 58,
      cloudLowPct: 6,
      cloudMidPct: 16,
      cloudHighPct: 48,
    }));
    const blocked = deriveHourFeatures(makeInput({
      cloudTotalPct: 58,
      cloudLowPct: 34,
      cloudMidPct: 12,
      cloudHighPct: 12,
    }));

    expect(translucent.cloudOpticalThicknessPct).toBeLessThan(blocked.cloudOpticalThicknessPct);
    expect(translucent.highCloudTranslucencyScore).toBeGreaterThan(blocked.highCloudTranslucencyScore);
    expect(translucent.lowCloudBlockingScore).toBeLessThan(blocked.lowCloudBlockingScore);
  });

  it('derives a seeing proxy from gustiness, BLH, and CAPE when no external seeing is provided', () => {
    const calm = deriveHourFeatures(makeInput({
      windKph: 3,
      gustKph: 5,
      boundaryLayerHeightM: 300,
      capeJkg: 0,
    }));
    const turbulent = deriveHourFeatures(makeInput({
      windKph: 22,
      gustKph: 40,
      boundaryLayerHeightM: 1500,
      capeJkg: 1500,
    }));

    expect(calm.seeingScore).not.toBeNull();
    expect(turbulent.seeingScore).not.toBeNull();
    expect(calm.seeingScore!).toBeGreaterThan(turbulent.seeingScore!);
  });

  it('preserves externally provided seeingScore without overwriting with proxy', () => {
    const features = deriveHourFeatures(makeInput({
      seeingScore: 85,
      windKph: 22,
      gustKph: 40,
      boundaryLayerHeightM: 1500,
      capeJkg: 1500,
    }));

    // External value should be preserved, not overwritten by the proxy
    expect(features.seeingScore).toBe(85);
  });
});
