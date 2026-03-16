import { describe, expect, it } from 'vitest';
import { scoreAllDays, type ScoreHoursInput } from './score-hours.js';

describe('scoreAllDays moon timeline scoring', () => {
  it('gives post-moonset night hours the full dark-sky bonus', () => {
    const input: ScoreHoursInput = {
      lat: 53.8,
      lon: -1.57,
      weather: {
        hourly: {
          time: ['2026-03-27T03:00:00Z', '2026-03-27T05:00:00Z'],
          cloudcover: [0, 0],
          cloudcover_low: [0, 0],
          cloudcover_mid: [0, 0],
          cloudcover_high: [0, 0],
          visibility: [30000, 30000],
          temperature_2m: [8, 6],
          relativehumidity_2m: [60, 65],
          dewpoint_2m: [4, 3],
          precipitation: [0, 0],
          windspeed_10m: [5, 4],
          windgusts_10m: [8, 7],
          cape: [0, 0],
          vapour_pressure_deficit: [0.7, 0.6],
          total_column_integrated_water_vapour: [10, 10],
        },
        daily: {
          sunrise: ['2026-03-27T05:52:00Z'],
          sunset: ['2026-03-27T18:31:00Z'],
        },
      },
      airQuality: {
        hourly: {
          time: ['2026-03-27T03:00:00Z', '2026-03-27T05:00:00Z'],
          aerosol_optical_depth: [0.05, 0.05],
          dust: [0, 0],
          european_aqi: [10, 10],
          uv_index: [0, 0],
        },
      },
      precipProb: {
        hourly: {
          time: ['2026-03-27T03:00:00Z', '2026-03-27T05:00:00Z'],
          precipitation_probability: [0, 0],
        },
      },
      metarRaw: [],
      sunsetHue: [],
      ensemble: { hourly: { time: [] } },
      azimuthByPhase: {},
    };

    const result = scoreAllDays(input, new Date('2026-03-27T12:00:00Z'));
    const today = result.dailySummary[0];
    const earlyNight = today.hours.find(hour => hour.hour === '03:00');
    const lateNight = today.hours.find(hour => hour.hour === '05:00');

    expect(earlyNight?.astro).toBeLessThan(lateNight?.astro ?? 0);
    expect(today.darkSkyStartsAt).toBe('05:00');
    expect(today.bestAstroHour).toBe('05:00');
  });
});
