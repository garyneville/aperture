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
    solarAltitudeDeg: 4,
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

  it('derives a meaningful crepuscular score during golden hour with favourable cloud structure', () => {
    const good = deriveHourFeatures(makeInput({
      solarAltitudeDeg: 3,
      isGolden: true,
      cloudTotalPct: 55,
      cloudLowPct: 12,
      cloudMidPct: 22,
      cloudHighPct: 30,
      aerosolOpticalDepth: 0.18,
      humidityPct: 62,
      visibilityKm: 20,
    }));

    expect(good.crepuscularScore).toBeGreaterThan(10);
  });

  it('returns zero crepuscular score when sun is well above the crepuscular window', () => {
    const midday = deriveHourFeatures(makeInput({
      solarAltitudeDeg: 45,
      isGolden: false,
      isBlue: false,
    }));

    expect(midday.crepuscularScore).toBe(0);
  });

  it('returns zero crepuscular score when sun is well below the crepuscular window', () => {
    const deepNight = deriveHourFeatures(makeInput({
      solarAltitudeDeg: -15,
      isGolden: false,
      isBlue: false,
      isNight: true,
    }));

    expect(deepNight.crepuscularScore).toBe(0);
  });

  it('scores higher with broken cloud than with overcast or clear sky', () => {
    const broken = deriveHourFeatures(makeInput({
      solarAltitudeDeg: 3,
      cloudTotalPct: 55,
      cloudLowPct: 10,
      cloudMidPct: 25,
      cloudHighPct: 25,
      aerosolOpticalDepth: 0.18,
    }));
    const overcast = deriveHourFeatures(makeInput({
      solarAltitudeDeg: 3,
      cloudTotalPct: 95,
      cloudLowPct: 70,
      cloudMidPct: 15,
      cloudHighPct: 10,
      aerosolOpticalDepth: 0.18,
    }));
    const clear = deriveHourFeatures(makeInput({
      solarAltitudeDeg: 3,
      cloudTotalPct: 2,
      cloudLowPct: 1,
      cloudMidPct: 0,
      cloudHighPct: 1,
      aerosolOpticalDepth: 0.18,
    }));

    expect(broken.crepuscularScore).toBeGreaterThan(overcast.crepuscularScore);
    expect(broken.crepuscularScore).toBeGreaterThan(clear.crepuscularScore);
  });

  it('penalises very high or very low AOD for crepuscular beams', () => {
    const sweetSpot = deriveHourFeatures(makeInput({
      solarAltitudeDeg: 3,
      cloudTotalPct: 50,
      cloudMidPct: 25,
      cloudHighPct: 20,
      cloudLowPct: 10,
      aerosolOpticalDepth: 0.18,
    }));
    const tooClean = deriveHourFeatures(makeInput({
      solarAltitudeDeg: 3,
      cloudTotalPct: 50,
      cloudMidPct: 25,
      cloudHighPct: 20,
      cloudLowPct: 10,
      aerosolOpticalDepth: 0.01,
    }));

    expect(sweetSpot.crepuscularScore).toBeGreaterThan(tooClean.crepuscularScore);
  });
});
