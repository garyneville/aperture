import { describe, it, expect } from 'vitest';
import { computeClearingSignal } from './satellite-clearing.js';
import type { NowcastSatelliteData } from '../contracts.js';

function makeSatellite(observed: number, clearSky: number, timeStr: string): NowcastSatelliteData {
  return {
    current: { time: timeStr, shortwave_radiation_instant: observed },
    current_clear_sky: { shortwave_radiation: clearSky },
  };
}

describe('computeClearingSignal', () => {
  const now = new Date('2026-04-05T14:00:00Z');

  it('returns clearing when observed radiation exceeds forecast expectation', () => {
    // observed = 400 W/m² out of 500 clear sky → cloud factor = 0.2
    // forecast cloud = 80% → fraction = 0.8
    // delta = 0.8 - 0.2 = 0.6 → clearing
    const satellite = makeSatellite(400, 500, '2026-04-05T13:45:00Z');
    const result = computeClearingSignal({ satellite, forecastCloudCover: 80, now });

    expect(result).not.toBeNull();
    expect(result!.direction).toBe('clearing');
    expect(result!.magnitude).toBeCloseTo(0.6, 1);
    expect(result!.confidence).toBe('high');
    expect(result!.source).toBe('satellite-radiation');
  });

  it('returns thickening when observed is darker than forecast', () => {
    // observed = 50 W/m² out of 500 clear sky → cloud factor = 0.9
    // forecast cloud = 30% → fraction = 0.3
    // delta = 0.3 - 0.9 = -0.6 → thickening
    const satellite = makeSatellite(50, 500, '2026-04-05T13:45:00Z');
    const result = computeClearingSignal({ satellite, forecastCloudCover: 30, now });

    expect(result).not.toBeNull();
    expect(result!.direction).toBe('thickening');
    expect(result!.magnitude).toBeCloseTo(0.6, 1);
  });

  it('returns neutral when delta is below significance threshold', () => {
    // observed = 350 W/m² out of 500 → cloud factor = 0.3
    // forecast cloud = 35% → fraction = 0.35
    // delta = 0.35 - 0.3 = 0.05 → neutral
    const satellite = makeSatellite(350, 500, '2026-04-05T13:45:00Z');
    const result = computeClearingSignal({ satellite, forecastCloudCover: 35, now });

    expect(result).not.toBeNull();
    expect(result!.direction).toBe('neutral');
  });

  it('returns null when data is stale (>45 min old)', () => {
    const satellite = makeSatellite(400, 500, '2026-04-05T12:00:00Z');
    const result = computeClearingSignal({ satellite, forecastCloudCover: 80, now });
    expect(result).toBeNull();
  });

  it('returns null when clear-sky radiation is too low (night)', () => {
    const satellite = makeSatellite(5, 8, '2026-04-05T13:45:00Z');
    const result = computeClearingSignal({ satellite, forecastCloudCover: 50, now });
    expect(result).toBeNull();
  });

  it('returns null when satellite data is missing', () => {
    const result = computeClearingSignal({ satellite: {}, forecastCloudCover: 50, now });
    expect(result).toBeNull();
  });

  it('assigns medium confidence for 20-35 min old data', () => {
    // 25 minutes old
    const satellite = makeSatellite(400, 500, '2026-04-05T13:35:00Z');
    const result = computeClearingSignal({ satellite, forecastCloudCover: 80, now });

    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('medium');
  });

  it('assigns low confidence for 35-45 min old data', () => {
    // 40 minutes old
    const satellite = makeSatellite(400, 500, '2026-04-05T13:20:00Z');
    const result = computeClearingSignal({ satellite, forecastCloudCover: 80, now });

    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('low');
  });

  it('clamps cloud factor between 0 and 1', () => {
    // observed > clear sky (sensor anomaly) → would give negative cloud factor
    const satellite = makeSatellite(600, 500, '2026-04-05T13:45:00Z');
    const result = computeClearingSignal({ satellite, forecastCloudCover: 50, now });

    expect(result).not.toBeNull();
    expect(result!.observedCloudFactor).toBe(0);
  });
});
