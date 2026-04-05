import { describe, it, expect } from 'vitest';
import {
  detectPostFrontalClarity,
  findPostFrontalClarityPeak,
  type HourSlice,
} from './post-frontal-clarity.js';

function makeHour(overrides: Partial<HourSlice> & { ts: string }): HourSlice {
  return {
    precipMm: 0,
    precipProbPct: 0,
    visibilityKm: 15,
    humidityPct: 70,
    windDirectionDeg: 180,
    aerosolOpticalDepth: 0.15,
    ...overrides,
  };
}

function makeTimestamp(baseDate: string, hourOffset: number): string {
  const d = new Date(baseDate);
  d.setUTCHours(d.getUTCHours() + hourOffset);
  return d.toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00');
}

describe('detectPostFrontalClarity', () => {
  it('returns null when insufficient lookback hours', () => {
    const hours = [
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 0) }),
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 1) }),
    ];
    expect(detectPostFrontalClarity(hours, 1)).toBeNull();
  });

  it('returns score 0 when current hour is still raining', () => {
    const hours = Array.from({ length: 7 }, (_, i) =>
      makeHour({
        ts: makeTimestamp('2026-04-05T06:00:00Z', i),
        precipMm: i < 4 ? 1 : 0,
        precipProbPct: i < 6 ? 30 : 0,
        humidityPct: 85,
      }),
    );
    // Hour 5 still has precip prob > 10%
    const result = detectPostFrontalClarity(hours, 5);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
  });

  it('returns score 0 when no recent rain', () => {
    const hours = Array.from({ length: 7 }, (_, i) =>
      makeHour({
        ts: makeTimestamp('2026-04-05T06:00:00Z', i),
        precipMm: 0,
        visibilityKm: 30,
        humidityPct: 50,
      }),
    );
    const result = detectPostFrontalClarity(hours, 6);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
  });

  it('detects classic post-frontal clarity: rain → clear, wind shift, vis jump, humidity drop', () => {
    const hours: HourSlice[] = [
      // Hours 0-3: rain period (4 hours of 2mm/h = 8mm total)
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 0), precipMm: 2, precipProbPct: 80, humidityPct: 92, visibilityKm: 5, windDirectionDeg: 200 }),
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 1), precipMm: 2, precipProbPct: 70, humidityPct: 90, visibilityKm: 6, windDirectionDeg: 210 }),
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 2), precipMm: 2, precipProbPct: 50, humidityPct: 88, visibilityKm: 8, windDirectionDeg: 220 }),
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 3), precipMm: 1, precipProbPct: 30, humidityPct: 82, visibilityKm: 12, windDirectionDeg: 240 }),
      // Hour 4: transition
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 4), precipMm: 0, precipProbPct: 8, humidityPct: 65, visibilityKm: 22, windDirectionDeg: 280 }),
      // Hour 5: post-frontal clarity window
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 5), precipMm: 0, precipProbPct: 3, humidityPct: 52, visibilityKm: 32, windDirectionDeg: 300, aerosolOpticalDepth: 0.03 }),
      // Hour 6: still in clarity window
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 6), precipMm: 0, precipProbPct: 5, humidityPct: 48, visibilityKm: 35, windDirectionDeg: 310, aerosolOpticalDepth: 0.04 }),
    ];

    const result5 = detectPostFrontalClarity(hours, 5);
    expect(result5).not.toBeNull();
    expect(result5!.score).toBeGreaterThan(50);
    expect(result5!.recentRainMm).toBeGreaterThanOrEqual(2);

    const result6 = detectPostFrontalClarity(hours, 6);
    expect(result6).not.toBeNull();
    expect(result6!.score).toBeGreaterThan(40);
  });

  it('scores lower when only rain + visibility signals present (no wind shift or humidity drop)', () => {
    const hours: HourSlice[] = [
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 0), precipMm: 3, precipProbPct: 80, humidityPct: 70, visibilityKm: 8, windDirectionDeg: 180 }),
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 1), precipMm: 2, precipProbPct: 60, humidityPct: 70, visibilityKm: 10, windDirectionDeg: 180 }),
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 2), precipMm: 1, precipProbPct: 30, humidityPct: 70, visibilityKm: 15, windDirectionDeg: 180 }),
      // Post-rain but no wind shift and humidity stays the same
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 3), precipMm: 0, precipProbPct: 5, humidityPct: 68, visibilityKm: 28, windDirectionDeg: 185 }),
    ];

    const result = detectPostFrontalClarity(hours, 3);
    expect(result).not.toBeNull();
    // Some score from rain + visibility, but weaker without wind shift + humidity
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThan(60);
  });

  it('returns null when wind direction is unavailable for all hours', () => {
    const hours: HourSlice[] = Array.from({ length: 6 }, (_, i) =>
      makeHour({
        ts: makeTimestamp('2026-04-05T06:00:00Z', i),
        precipMm: i < 3 ? 2 : 0,
        precipProbPct: i < 3 ? 70 : 5,
        humidityPct: i < 3 ? 90 : 50,
        visibilityKm: i < 3 ? 5 : 30,
        windDirectionDeg: null,
      }),
    );

    const result = detectPostFrontalClarity(hours, 5);
    expect(result).not.toBeNull();
    // Should still produce a score (wind shift defaults to neutral 50)
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.windShiftDeg).toBeNull();
  });

  it('handles AOD bonus for very clean post-rain air', () => {
    const hours: HourSlice[] = [
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 0), precipMm: 3, precipProbPct: 80, humidityPct: 92, visibilityKm: 5 }),
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 1), precipMm: 2, precipProbPct: 60, humidityPct: 88, visibilityKm: 8 }),
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 2), precipMm: 1, precipProbPct: 30, humidityPct: 80, visibilityKm: 15 }),
      // Very clean air: AOD below 0.05 threshold
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', 3), precipMm: 0, precipProbPct: 5, humidityPct: 50, visibilityKm: 30, aerosolOpticalDepth: 0.03 }),
    ];

    const resultClean = detectPostFrontalClarity(hours, 3)!;

    // Same scenario but with normal AOD
    hours[3] = makeHour({
      ts: makeTimestamp('2026-04-05T06:00:00Z', 3),
      precipMm: 0, precipProbPct: 5, humidityPct: 50, visibilityKm: 30, aerosolOpticalDepth: 0.20,
    });
    const resultNormal = detectPostFrontalClarity(hours, 3)!;

    expect(resultClean.score).toBeGreaterThanOrEqual(resultNormal.score);
  });
});

describe('findPostFrontalClarityPeak', () => {
  it('returns peakScore 0 and null window when no post-frontal event', () => {
    const hours = Array.from({ length: 8 }, (_, i) =>
      makeHour({ ts: makeTimestamp('2026-04-05T06:00:00Z', i), precipMm: 0, visibilityKm: 15, humidityPct: 65 }),
    );
    const { peakScore, windowLabel } = findPostFrontalClarityPeak(hours);
    expect(peakScore).toBe(0);
    expect(windowLabel).toBeNull();
  });

  it('finds peak and window for a classic post-frontal event', () => {
    const hours: HourSlice[] = [
      makeHour({ ts: '2026-04-05T06:00:00', precipMm: 3, precipProbPct: 80, humidityPct: 92, visibilityKm: 4, windDirectionDeg: 200 }),
      makeHour({ ts: '2026-04-05T07:00:00', precipMm: 3, precipProbPct: 70, humidityPct: 90, visibilityKm: 5, windDirectionDeg: 210 }),
      makeHour({ ts: '2026-04-05T08:00:00', precipMm: 2, precipProbPct: 50, humidityPct: 85, visibilityKm: 8, windDirectionDeg: 220 }),
      makeHour({ ts: '2026-04-05T09:00:00', precipMm: 1, precipProbPct: 20, humidityPct: 75, visibilityKm: 15, windDirectionDeg: 250 }),
      makeHour({ ts: '2026-04-05T10:00:00', precipMm: 0, precipProbPct: 5, humidityPct: 55, visibilityKm: 30, windDirectionDeg: 290, aerosolOpticalDepth: 0.04 }),
      makeHour({ ts: '2026-04-05T11:00:00', precipMm: 0, precipProbPct: 3, humidityPct: 48, visibilityKm: 35, windDirectionDeg: 300, aerosolOpticalDepth: 0.03 }),
      makeHour({ ts: '2026-04-05T12:00:00', precipMm: 0, precipProbPct: 5, humidityPct: 50, visibilityKm: 32, windDirectionDeg: 310, aerosolOpticalDepth: 0.04 }),
    ];

    const { peakScore, windowLabel } = findPostFrontalClarityPeak(hours);
    expect(peakScore).toBeGreaterThan(30);
    expect(windowLabel).not.toBeNull();
  });
});
