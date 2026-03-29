import { describe, expect, it } from 'vitest';
import { scoreAllDays, type ScoreHoursInput } from './score-hours.js';

const BASE_WEATHER_HOURLY = {
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
};

describe('scoreAllDays moon timeline scoring', () => {
  it('detects moonset time even when the moon sets after astronomical darkness ends', () => {
    // 2026-03-27: sunrise 05:52 UTC, sunset 18:31 UTC.
    // Astronomical darkness ends at ~04:22 UTC (90 min before sunrise).
    // The moon sets at ~05:00 UTC — after astronomical darkness, inside nautical twilight.
    // 03:00 UTC: solar altitude ~-23° → genuinely dark, astro scores despite moon being up.
    // 05:00 UTC: solar altitude ~-7.75° → inside nautical twilight, astro must be 0.
    const input: ScoreHoursInput = {
      lat: 53.8,
      lon: -1.57,
      weather: {
        hourly: {
          time: ['2026-03-27T03:00:00Z', '2026-03-27T05:00:00Z'],
          ...BASE_WEATHER_HOURLY,
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

    // 03:00 is genuinely astronomically dark (solar altitude ~-23°) — astro should be positive.
    expect(earlyNight?.astro).toBeGreaterThan(0);
    // 05:00 is only in nautical twilight (solar altitude ~-7.75°) — astro must be zero.
    expect(lateNight?.astro).toBe(0);
    // darkSkyStartsAt reflects moonset time (05:00), not astronomical twilight end.
    expect(today.darkSkyStartsAt).toBe('05:00');
    // Best astro is the genuinely dark hour (03:00), not the post-moonset twilight hour.
    expect(today.bestAstroHour).toBe('03:00');
  });
});

describe('scoreAllDays astronomical twilight boundary', () => {
  it('gives astro=0 to isNight hours still inside astronomical twilight', () => {
    // 2026-03-17 scenario (the original bug report): Leeds, sunset ~18:12 UTC.
    // 19:00 UTC: isNight=true, but solar altitude ~-7° — inside astronomical twilight.
    // 21:00 UTC: isNight=true, solar altitude ~-23° — genuinely astronomically dark.
    // Before the fix, 19:00 was scored as a valid astro hour and drove a window recommendation.
    const base = {
      lat: 53.8,
      lon: -1.57,
      weather: {
        hourly: {
          time: ['2026-03-17T19:00:00Z', '2026-03-17T21:00:00Z'],
          cloudcover: [0, 0],
          cloudcover_low: [0, 0],
          cloudcover_mid: [0, 0],
          cloudcover_high: [0, 0],
          visibility: [30000, 30000],
          temperature_2m: [7, 5],
          relativehumidity_2m: [55, 60],
          dewpoint_2m: [3, 2],
          precipitation: [0, 0],
          windspeed_10m: [5, 4],
          windgusts_10m: [8, 7],
          cape: [0, 0],
          vapour_pressure_deficit: [0.7, 0.6],
          total_column_integrated_water_vapour: [10, 10],
        },
        daily: {
          sunrise: ['2026-03-17T06:20:00Z'],
          sunset: ['2026-03-17T18:12:00Z'],
        },
      },
      airQuality: {
        hourly: {
          time: ['2026-03-17T19:00:00Z', '2026-03-17T21:00:00Z'],
          aerosol_optical_depth: [0.05, 0.05],
          dust: [0, 0],
          european_aqi: [10, 10],
          uv_index: [0, 0],
        },
      },
      precipProb: {
        hourly: {
          time: ['2026-03-17T19:00:00Z', '2026-03-17T21:00:00Z'],
          precipitation_probability: [0, 0],
        },
      },
      metarRaw: [] as [],
      sunsetHue: [] as [],
      ensemble: { hourly: { time: [] as string[] } },
      azimuthByPhase: {},
    } satisfies ScoreHoursInput;

    const result = scoreAllDays(base, new Date('2026-03-17T12:00:00Z'));
    const today = result.dailySummary[0];
    const twilightHour = today.hours.find(h => h.hour === '19:00');
    const darkHour = today.hours.find(h => h.hour === '21:00');

    // Both hours are flagged isNight (outside blue hour window).
    expect(twilightHour?.isNight).toBe(true);
    expect(darkHour?.isNight).toBe(true);

    // 19:00 is still inside astronomical twilight — no astro score.
    expect(twilightHour?.astro).toBe(0);
    // 21:00 is genuinely dark — astro score must be positive.
    expect(darkHour?.astro).toBeGreaterThan(0);

    // The dark hour should be chosen as the best astro hour, not the twilight hour.
    expect(today.bestAstroHour).toBe('21:00');
  });
});

describe('scoreAllDays headline scoring', () => {
  it('uses the weighted night final score, not raw astro score, for the daily headline', () => {
    const input: ScoreHoursInput = {
      lat: 53.82703,
      lon: -1.570755,
      weather: {
        hourly: {
          time: ['2026-03-16T04:00:00Z', '2026-03-16T07:00:00Z'],
          cloudcover: [3, 55],
          cloudcover_low: [0, 35],
          cloudcover_mid: [0, 10],
          cloudcover_high: [3, 10],
          visibility: [20500, 16000],
          temperature_2m: [4, 5],
          relativehumidity_2m: [78, 82],
          dewpoint_2m: [2, 3],
          precipitation: [0, 0],
          windspeed_10m: [6, 12],
          windgusts_10m: [8, 14],
          cape: [0, 0],
          vapour_pressure_deficit: [0.4, 0.3],
          total_column_integrated_water_vapour: [10, 12],
        },
        daily: {
          sunrise: ['2026-03-16T06:18:00Z'],
          sunset: ['2026-03-16T18:11:00Z'],
        },
      },
      airQuality: {
        hourly: {
          time: ['2026-03-16T04:00:00Z', '2026-03-16T07:00:00Z'],
          aerosol_optical_depth: [0.09, 0.1],
          dust: [0, 0],
          european_aqi: [10, 10],
          uv_index: [0, 0],
        },
      },
      precipProb: {
        hourly: {
          time: ['2026-03-16T04:00:00Z', '2026-03-16T07:00:00Z'],
          precipitation_probability: [0, 22],
        },
      },
      metarRaw: [],
      sunsetHue: [],
      ensemble: { hourly: { time: [] } },
      azimuthByPhase: {},
    };

    const result = scoreAllDays(input, new Date('2026-03-16T12:00:00Z'));
    const today = result.dailySummary[0];
    const maxNightFinal = Math.max(...today.hours.filter(hour => hour.isNight).map(hour => hour.score));

    expect(today.astroScore).toBeGreaterThan(maxNightFinal);
    expect(today.headlineScore).toBe(Math.max(today.photoScore, maxNightFinal));
    expect(today.headlineScore).toBeLessThan(today.astroScore);
  });
});

describe('scoreAllDays astro confidence', () => {
  it('returns astroConfidence from night-hour ensemble data', () => {
    const nightTs = ['2026-03-27T01:00:00Z', '2026-03-27T02:00:00Z', '2026-03-27T03:00:00Z'];
    const input: ScoreHoursInput = {
      lat: 53.8,
      lon: -1.57,
      weather: {
        hourly: {
          time: nightTs,
          cloudcover: [5, 8, 6],
          cloudcover_low: [0, 0, 0],
          cloudcover_mid: [0, 0, 0],
          cloudcover_high: [5, 8, 6],
          visibility: [30000, 30000, 30000],
          temperature_2m: [6, 6, 6],
          relativehumidity_2m: [65, 65, 65],
          dewpoint_2m: [3, 3, 3],
          precipitation: [0, 0, 0],
          windspeed_10m: [4, 4, 4],
          windgusts_10m: [7, 7, 7],
          cape: [0, 0, 0],
          vapour_pressure_deficit: [0.6, 0.6, 0.6],
          total_column_integrated_water_vapour: [10, 10, 10],
        },
        daily: {
          sunrise: ['2026-03-27T05:52:00Z'],
          sunset: ['2026-03-27T18:31:00Z'],
        },
      },
      airQuality: {
        hourly: {
          time: nightTs,
          aerosol_optical_depth: [0.05, 0.05, 0.05],
          dust: [0, 0, 0],
          european_aqi: [10, 10, 10],
          uv_index: [0, 0, 0],
        },
      },
      precipProb: {
        hourly: {
          time: nightTs,
          precipitation_probability: [0, 0, 0],
        },
      },
      metarRaw: [],
      sunsetHue: [],
      // Ensemble with low spread on night hours → high astro confidence
      ensemble: {
        hourly: {
          time: nightTs,
          cloudcover_member01: [5, 8, 6],
          cloudcover_member02: [6, 7, 5],
          cloudcover_member03: [4, 9, 7],
        } as Record<string, (number | null)[] | string[]>,
      },
      azimuthByPhase: {},
    };

    const result = scoreAllDays(input, new Date('2026-03-27T12:00:00Z'));
    const today = result.dailySummary[0];

    // Night hours have low ensemble spread → astroConfidence should be 'high'
    expect(today.astroConfidence).toBe('high');
    expect(today.astroConfidenceStdDev).toBeGreaterThanOrEqual(0);
    // Daylight confidence should be 'unknown' (no golden-hour timestamps)
    expect(today.confidence).toBe('unknown');
    // Debug context should carry both
    expect(result.debugContext.scores?.astroConfidence).toBe('High');
    expect(result.debugContext.scores?.certainty).toBe('unknown');
  });

  it('returns astroConfidence unknown when no ensemble data for night hours', () => {
    const nightTs = ['2026-03-27T02:00:00Z'];
    const input: ScoreHoursInput = {
      lat: 53.8,
      lon: -1.57,
      weather: {
        hourly: {
          time: nightTs,
          cloudcover: [10],
          cloudcover_low: [0],
          cloudcover_mid: [0],
          cloudcover_high: [10],
          visibility: [30000],
          temperature_2m: [6],
          relativehumidity_2m: [65],
          dewpoint_2m: [3],
          precipitation: [0],
          windspeed_10m: [4],
          windgusts_10m: [7],
          cape: [0],
          vapour_pressure_deficit: [0.6],
          total_column_integrated_water_vapour: [10],
        },
        daily: {
          sunrise: ['2026-03-27T05:52:00Z'],
          sunset: ['2026-03-27T18:31:00Z'],
        },
      },
      airQuality: { hourly: { time: nightTs, aerosol_optical_depth: [0.05], dust: [0], european_aqi: [10], uv_index: [0] } },
      precipProb: { hourly: { time: nightTs, precipitation_probability: [0] } },
      metarRaw: [],
      sunsetHue: [],
      ensemble: { hourly: { time: [] } }, // no ensemble data
      azimuthByPhase: {},
    };

    const result = scoreAllDays(input, new Date('2026-03-27T12:00:00Z'));
    const today = result.dailySummary[0];

    expect(today.astroConfidence).toBe('unknown');
    expect(today.astroConfidenceStdDev).toBeNull();
  });
});

describe('scoreAllDays AOD astro scoring', () => {
  it('penalises hazy astro hours more than clean ones', () => {
    const input: ScoreHoursInput = {
      lat: 53.8,
      lon: -1.57,
      weather: {
        hourly: {
          time: ['2026-03-27T03:00:00Z', '2026-03-27T04:00:00Z'],
          cloudcover: [0, 0],
          cloudcover_low: [0, 0],
          cloudcover_mid: [0, 0],
          cloudcover_high: [0, 0],
          visibility: [30000, 30000],
          temperature_2m: [6, 6],
          relativehumidity_2m: [65, 65],
          dewpoint_2m: [3, 3],
          precipitation: [0, 0],
          windspeed_10m: [4, 4],
          windgusts_10m: [7, 7],
          cape: [0, 0],
          vapour_pressure_deficit: [0.6, 0.6],
          total_column_integrated_water_vapour: [10, 10],
        },
        daily: {
          sunrise: ['2026-03-27T05:52:00Z'],
          sunset: ['2026-03-27T18:31:00Z'],
        },
      },
      airQuality: {
        hourly: {
          time: ['2026-03-27T03:00:00Z', '2026-03-27T04:00:00Z'],
          aerosol_optical_depth: [0.05, 0.4],
          dust: [0, 0],
          european_aqi: [10, 10],
          uv_index: [0, 0],
        },
      },
      precipProb: {
        hourly: {
          time: ['2026-03-27T03:00:00Z', '2026-03-27T04:00:00Z'],
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
    const cleanHour = today.hours.find(hour => hour.hour === '03:00');
    const hazyHour = today.hours.find(hour => hour.hour === '04:00');

    expect(cleanHour?.astro).toBeGreaterThan(hazyHour?.astro ?? 0);
    expect(cleanHour?.aod).toBe(0.05);
    expect(hazyHour?.aod).toBe(0.4);
  });
});

describe('scoreAllDays clear-sky AM/PM scoring', () => {
  // Regression test for: https://github.com/garyneville/home/issues/166
  // A cloudless day with 0% rain, good visibility, and low wind was scoring
  // 25 (AM) / 35 (PM) — too punitive for an objectively pleasant shooting day.
  it('gives a golden-hour score above 35 on a cloudless, low-wind morning with decent visibility', () => {
    // 17 Mar 2026: sunrise 06:20 UTC, sunset 18:12 UTC.
    // Simulate the golden-hour window at 07:00 UTC — clear skies, 10 km visibility, 5 km/h wind.
    const input: ScoreHoursInput = {
      lat: 53.8,
      lon: -1.57,
      weather: {
        hourly: {
          time: ['2026-03-17T07:00:00Z'],
          cloudcover: [0],
          cloudcover_low: [0],
          cloudcover_mid: [0],
          cloudcover_high: [0],
          visibility: [10000],
          temperature_2m: [8],
          relativehumidity_2m: [65],
          dewpoint_2m: [4],
          precipitation: [0],
          windspeed_10m: [5],
          windgusts_10m: [8],
          cape: [0],
          vapour_pressure_deficit: [0.6],
          total_column_integrated_water_vapour: [10],
        },
        daily: {
          sunrise: ['2026-03-17T06:20:00Z'],
          sunset: ['2026-03-17T18:12:00Z'],
        },
      },
      airQuality: {
        hourly: {
          time: ['2026-03-17T07:00:00Z'],
          aerosol_optical_depth: [0.1],
          dust: [0],
          european_aqi: [10],
          uv_index: [0],
        },
      },
      precipProb: {
        hourly: {
          time: ['2026-03-17T07:00:00Z'],
          precipitation_probability: [0],
        },
      },
      metarRaw: [],
      sunsetHue: [],
      ensemble: { hourly: { time: [] } },
      azimuthByPhase: {},
    };

    const result = scoreAllDays(input, new Date('2026-03-17T12:00:00Z'));
    const today = result.dailySummary[0];
    const goldenHour = today.hours.find(h => h.hour === '07:00');

    // Hour should be classified as golden AM
    expect(goldenHour?.isGoldAm).toBe(true);
    // Cloudless golden hours must score above 35 — clear skies + decent visibility are photogenic
    expect(goldenHour?.score).toBeGreaterThan(35);
    // Drama should reflect the clear-sky bonus (ct < 15 → +12)
    expect(goldenHour?.drama).toBeGreaterThan(40);
    // Clarity should reflect the clear-sky visibility bonus (ct < 20, visK > 5 → +6)
    expect(goldenHour?.clarity).toBeGreaterThan(40);
  });

  it('gives a PM golden-hour score above 40 on a cloudless afternoon with excellent visibility', () => {
    // Simulate a PM golden-hour window at 18:00 UTC — clear skies, 19 km visibility, 14 km/h wind.
    const input: ScoreHoursInput = {
      lat: 53.8,
      lon: -1.57,
      weather: {
        hourly: {
          time: ['2026-03-17T18:00:00Z'],
          cloudcover: [0],
          cloudcover_low: [0],
          cloudcover_mid: [0],
          cloudcover_high: [0],
          visibility: [19000],
          temperature_2m: [17],
          relativehumidity_2m: [55],
          dewpoint_2m: [7],
          precipitation: [0],
          windspeed_10m: [14],
          windgusts_10m: [20],
          cape: [0],
          vapour_pressure_deficit: [1.0],
          total_column_integrated_water_vapour: [12],
        },
        daily: {
          sunrise: ['2026-03-17T06:20:00Z'],
          sunset: ['2026-03-17T18:12:00Z'],
        },
      },
      airQuality: {
        hourly: {
          time: ['2026-03-17T18:00:00Z'],
          aerosol_optical_depth: [0.1],
          dust: [0],
          european_aqi: [10],
          uv_index: [2],
        },
      },
      precipProb: {
        hourly: {
          time: ['2026-03-17T18:00:00Z'],
          precipitation_probability: [0],
        },
      },
      metarRaw: [],
      sunsetHue: [],
      ensemble: { hourly: { time: [] } },
      azimuthByPhase: {},
    };

    const result = scoreAllDays(input, new Date('2026-03-17T12:00:00Z'));
    const today = result.dailySummary[0];
    const pmHour = today.hours.find(h => h.hour === '18:00');

    // Hour should be classified as golden PM
    expect(pmHour?.isGoldPm).toBe(true);
    // Cloudless PM with excellent visibility must score above 40
    expect(pmHour?.score).toBeGreaterThan(40);
    // Clarity should reflect the clear-sky visibility bonus (ct < 20, visK > 10 → +12)
    expect(pmHour?.clarity).toBeGreaterThan(55);
  });
});

describe('scoreAllDays session scoring foundation', () => {
  it('adds per-hour session score traces to the debug context', () => {
    const input: ScoreHoursInput = {
      lat: 53.8,
      lon: -1.57,
      weather: {
        hourly: {
          time: ['2026-03-27T03:00:00Z', '2026-03-27T07:00:00Z'],
          cloudcover: [6, 55],
          cloudcover_low: [2, 35],
          cloudcover_mid: [1, 12],
          cloudcover_high: [3, 8],
          visibility: [26000, 6000],
          temperature_2m: [5, 7],
          relativehumidity_2m: [68, 95],
          dewpoint_2m: [2, 6],
          precipitation: [0, 0],
          windspeed_10m: [4, 3],
          windgusts_10m: [7, 5],
          cape: [0, 0],
          vapour_pressure_deficit: [0.6, 0.2],
          total_column_integrated_water_vapour: [9, 12],
        },
        daily: {
          sunrise: ['2026-03-27T05:52:00Z'],
          sunset: ['2026-03-27T18:31:00Z'],
        },
      },
      airQuality: {
        hourly: {
          time: ['2026-03-27T03:00:00Z', '2026-03-27T07:00:00Z'],
          aerosol_optical_depth: [0.05, 0.09],
          dust: [0, 0],
          european_aqi: [8, 12],
          uv_index: [0, 0],
        },
      },
      precipProb: {
        hourly: {
          time: ['2026-03-27T03:00:00Z', '2026-03-27T07:00:00Z'],
          precipitation_probability: [0, 18],
        },
      },
      metarRaw: [],
      sunsetHue: [],
      ensemble: { hourly: { time: [] } },
      azimuthByPhase: {},
    };

    const result = scoreAllDays(input, new Date('2026-03-27T12:00:00Z'));

    expect(result.debugContext.hourlyScoring).toHaveLength(2);
    expect(result.debugContext.hourlyScoring[0]?.sessionScores?.map(score => score.session)).toEqual(['astro', 'mist', 'golden-hour', 'storm']);
    expect(result.debugContext.hourlyScoring[1]?.sessionScores?.some(score => score.session === 'mist')).toBe(true);
    expect(result.debugContext.scores?.bestSession).toBeDefined();
  });

  it('propagates live CAPE into derived session features for storm selection', () => {
    const input: ScoreHoursInput = {
      lat: 53.8,
      lon: -1.57,
      weather: {
        hourly: {
          time: ['2026-07-10T19:00:00Z', '2026-07-10T20:00:00Z'],
          cloudcover: [78, 72],
          cloudcover_low: [34, 28],
          cloudcover_mid: [22, 24],
          cloudcover_high: [22, 20],
          visibility: [18000, 16000],
          temperature_2m: [22, 20],
          relativehumidity_2m: [78, 82],
          dewpoint_2m: [18, 17],
          precipitation: [0, 0.2],
          windspeed_10m: [18, 20],
          windgusts_10m: [26, 30],
          cape: [2200, 2500],
          vapour_pressure_deficit: [0.6, 0.5],
          total_column_integrated_water_vapour: [24, 26],
        },
        daily: {
          sunrise: ['2026-07-10T04:46:00Z'],
          sunset: ['2026-07-10T19:35:00Z'],
        },
      },
      airQuality: {
        hourly: {
          time: ['2026-07-10T19:00:00Z', '2026-07-10T20:00:00Z'],
          aerosol_optical_depth: [0.12, 0.14],
          dust: [0, 0],
          european_aqi: [18, 20],
          uv_index: [1, 0],
        },
      },
      precipProb: {
        hourly: {
          time: ['2026-07-10T19:00:00Z', '2026-07-10T20:00:00Z'],
          precipitation_probability: [55, 62],
        },
      },
      metarRaw: [],
      sunsetHue: [],
      ensemble: { hourly: { time: [] } },
      azimuthByPhase: {},
    };

    const result = scoreAllDays(input, new Date('2026-07-10T12:00:00Z'));
    const hasStormLeader = result.debugContext.hourlyScoring.some(hour => hour.sessionScores?.[0]?.session === 'storm');

    expect(hasStormLeader).toBe(true);
    expect(result.debugContext.scores?.bestSession?.session).toBe('storm');
  });
});
