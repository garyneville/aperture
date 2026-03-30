import { describe, expect, it } from 'vitest';
import { aggregateAzimuth, type AzimuthSampleMeta, type AzimuthWeatherData } from './aggregate-azimuth.js';

describe('aggregateAzimuth', () => {
  it('derives horizon-gap and gap-quality metrics alongside occlusion risk', () => {
    const sampleMeta: AzimuthSampleMeta[] = [
      { type: 'sunrise', bearing: 90, distanceKm: 160 },
    ];
    const scanResults: AzimuthWeatherData[] = [{
      hourly: {
        time: ['2026-03-27T06:00:00Z', '2026-03-27T07:00:00Z'],
        cloudcover: [42, 92],
        cloudcover_low: [12, 82],
        cloudcover_mid: [22, 8],
        cloudcover_high: [18, 2],
        precipitation_probability: [10, 80],
        precipitation: [0, 2],
        visibility: [18000, 5000],
      },
    }];

    const result = aggregateAzimuth(scanResults, sampleMeta);
    const open = result.byPhase.sunrise['2026-03-27T06:00:00Z'];
    const blocked = result.byPhase.sunrise['2026-03-27T07:00:00Z'];

    expect(open?.horizonGapPct).toBeGreaterThan(blocked?.horizonGapPct ?? 0);
    expect(open?.gapQualityScore).toBeGreaterThan(blocked?.gapQualityScore ?? 0);
    expect(open?.clearPathBonus).toBeGreaterThan(blocked?.clearPathBonus ?? 0);
    expect(open?.occlusionRisk).toBeLessThan(blocked?.occlusionRisk ?? 100);
  });
});
