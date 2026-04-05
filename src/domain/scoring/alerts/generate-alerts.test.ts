import { describe, expect, it } from 'vitest';
import { generateAlerts } from './generate-alerts.js';
import type { DerivedHourFeatures } from '../../../types/session-score.js';

function makeFeatures(overrides: Partial<DerivedHourFeatures> = {}): DerivedHourFeatures {
  return {
    hourLabel: '19:00',
    overallScore: 72,
    dramaScore: 78,
    clarityScore: 68,
    mistScore: 20,
    astroScore: 14,
    crepuscularScore: 12,
    transparencyScore: 60,
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
    dewPointSpreadC: 5,
    windKph: 11,
    gustKph: 18,
    windDirectionDeg: null,
    boundaryLayerTrapScore: null,
    hazeTrapRisk: null,
    cloudOpticalThicknessPct: 30,
    highCloudTranslucencyScore: 45,
    lowCloudBlockingScore: 20,
    moonIlluminationPct: 12,
    isGolden: true,
    isBlue: false,
    isNight: false,
    tags: ['golden hour'],
    diffuseToDirectRatio: null,
    hasFrost: null,
    ...overrides,
  };
}

describe('generateAlerts', () => {
  it('returns no alerts for calm conditions', () => {
    const hours = [makeFeatures(), makeFeatures(), makeFeatures()];
    expect(generateAlerts(hours)).toEqual([]);
  });

  it('generates warn-level lightning alert when lightningRisk >= 50', () => {
    const hours = [
      makeFeatures({ lightningRisk: 55 }),
      makeFeatures({ lightningRisk: 30 }),
    ];
    const alerts = generateAlerts(hours);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('warn');
    expect(alerts[0].category).toBe('lightning');
    expect(alerts[0].badge).toBe('⚡ Lightning risk');
  });

  it('generates info-level lightning alert when lightningRisk is 10–49', () => {
    const hours = [
      makeFeatures({ lightningRisk: 25 }),
      makeFeatures({ lightningRisk: 8 }),
    ];
    const alerts = generateAlerts(hours);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('info');
    expect(alerts[0].category).toBe('lightning');
    expect(alerts[0].badge).toBe('⚡ Lightning possible');
  });

  it('does not generate lightning alert when risk is below 10', () => {
    const hours = [makeFeatures({ lightningRisk: 5 })];
    expect(generateAlerts(hours).filter(a => a.category === 'lightning')).toHaveLength(0);
  });

  it('generates warn-level air quality alert when AQI > 100', () => {
    const hours = [makeFeatures({ europeanAqi: 120 })];
    const alerts = generateAlerts(hours);
    const aqAlert = alerts.find(a => a.category === 'air-quality');
    expect(aqAlert).toBeDefined();
    expect(aqAlert!.level).toBe('warn');
    expect(aqAlert!.badge).toBe('😷 Poor air quality');
  });

  it('does not alert on normal AQI', () => {
    const hours = [makeFeatures({ europeanAqi: 50 })];
    expect(generateAlerts(hours).filter(a => a.category === 'air-quality')).toHaveLength(0);
  });

  it('generates info-level pollen alert when > 100 grains/m³', () => {
    const hours = [makeFeatures({ pollenGrainsM3: 150 })];
    const alerts = generateAlerts(hours);
    const pollenAlert = alerts.find(a => a.category === 'pollen');
    expect(pollenAlert).toBeDefined();
    expect(pollenAlert!.level).toBe('info');
    expect(pollenAlert!.badge).toBe('🌿 High pollen');
  });

  it('generates warn-level dust alert when AOD > 0.4', () => {
    const hours = [makeFeatures({ aerosolOpticalDepth: 0.55 })];
    const alerts = generateAlerts(hours);
    const dustAlert = alerts.find(a => a.category === 'dust');
    expect(dustAlert).toBeDefined();
    expect(dustAlert!.level).toBe('warn');
    expect(dustAlert!.badge).toBe('🌫️ Saharan dust');
  });

  it('generates info-level UV alert when UV >= 8 and session > 2 hours', () => {
    const hours = [
      makeFeatures({ uvIndex: 9 }),
      makeFeatures({ uvIndex: 8 }),
      makeFeatures({ uvIndex: 7 }),
    ];
    const alerts = generateAlerts(hours);
    const uvAlert = alerts.find(a => a.category === 'uv-exposure');
    expect(uvAlert).toBeDefined();
    expect(uvAlert!.level).toBe('info');
    expect(uvAlert!.badge).toBe('☀️ High UV');
  });

  it('does not generate UV alert for short sessions (<= 2 hours)', () => {
    const hours = [
      makeFeatures({ uvIndex: 10 }),
      makeFeatures({ uvIndex: 9 }),
    ];
    expect(generateAlerts(hours).filter(a => a.category === 'uv-exposure')).toHaveLength(0);
  });

  it('sorts warn alerts before info alerts', () => {
    const hours = [
      makeFeatures({ lightningRisk: 55, europeanAqi: 120, pollenGrainsM3: 150 }),
      makeFeatures({ lightningRisk: 55, europeanAqi: 120, pollenGrainsM3: 150 }),
      makeFeatures({ lightningRisk: 55, europeanAqi: 120, pollenGrainsM3: 150 }),
    ];
    const alerts = generateAlerts(hours);
    const levels = alerts.map(a => a.level);
    const firstInfoIdx = levels.indexOf('info');
    const lastWarnIdx = levels.lastIndexOf('warn');
    if (firstInfoIdx >= 0 && lastWarnIdx >= 0) {
      expect(lastWarnIdx).toBeLessThan(firstInfoIdx);
    }
  });

  it('generates multiple alerts from a single set of hours', () => {
    const hours = [
      makeFeatures({
        lightningRisk: 60,
        europeanAqi: 110,
        aerosolOpticalDepth: 0.5,
        pollenGrainsM3: 200,
        uvIndex: 9,
      }),
      makeFeatures({
        lightningRisk: 60,
        europeanAqi: 110,
        aerosolOpticalDepth: 0.5,
        pollenGrainsM3: 200,
        uvIndex: 9,
      }),
      makeFeatures({
        lightningRisk: 60,
        europeanAqi: 110,
        aerosolOpticalDepth: 0.5,
        pollenGrainsM3: 200,
        uvIndex: 9,
      }),
    ];
    const alerts = generateAlerts(hours);
    const categories = alerts.map(a => a.category);
    expect(categories).toContain('lightning');
    expect(categories).toContain('air-quality');
    expect(categories).toContain('dust');
    expect(categories).toContain('pollen');
    expect(categories).toContain('uv-exposure');
  });

  it('handles empty input gracefully', () => {
    expect(generateAlerts([])).toEqual([]);
  });

  it('handles features with null values gracefully', () => {
    const hours = [makeFeatures({
      lightningRisk: null,
      europeanAqi: null,
      pollenGrainsM3: null,
      uvIndex: null,
    })];
    expect(generateAlerts(hours)).toEqual([]);
  });
});
