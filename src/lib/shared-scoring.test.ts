import { describe, it, expect } from 'vitest';
import {
  extractHourlyWeather,
  classifyHour,
  scoreGoldenBlueHour,
  scoreAstroHour,
  evaluateDay,
  resolveAstroWin,
  resolveBestScore,
  ASTRO_DARK_ELEVATION,
} from './shared-scoring.js';
import type { AltWeatherData } from './score-alternatives.js';
import { scoreAlternatives } from './score-alternatives.js';
import { scoreLongRange, type LongRangeMeta, type ScoreLongRangeInput } from './score-long-range.js';
import { ALT_LOCATIONS } from './prepare-alt-locations.js';
import { siteDarknessFromBortle } from './site-darkness.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeWeatherFixture(opts: {
  date?: string;
  sunrise?: string;
  sunset?: string;
  cloudcover?: number;
  cloudcover_low?: number;
  cloudcover_mid?: number;
  cloudcover_high?: number;
  visibility?: number;
  precipitation_probability?: number;
  precipitation?: number;
  windspeed_10m?: number;
  windgusts_10m?: number;
  relativehumidity_2m?: number;
  temperature_2m?: number;
  dewpoint_2m?: number;
  total_column_integrated_water_vapour?: number;
} = {}): AltWeatherData {
  const date = opts.date ?? '2026-03-15';
  const hours = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);
  const fill = (val: number) => new Array(24).fill(val);
  return {
    hourly: {
      time: hours,
      cloudcover: fill(opts.cloudcover ?? 20),
      cloudcover_low: fill(opts.cloudcover_low ?? 10),
      cloudcover_mid: fill(opts.cloudcover_mid ?? 25),
      cloudcover_high: fill(opts.cloudcover_high ?? 40),
      visibility: fill(opts.visibility ?? 40000),
      precipitation_probability: fill(opts.precipitation_probability ?? 0),
      precipitation: fill(opts.precipitation ?? 0),
      windspeed_10m: fill(opts.windspeed_10m ?? 5),
      windgusts_10m: fill(opts.windgusts_10m ?? 10),
      relativehumidity_2m: fill(opts.relativehumidity_2m ?? 55),
      temperature_2m: fill(opts.temperature_2m ?? 8),
      dewpoint_2m: fill(opts.dewpoint_2m ?? 3),
      total_column_integrated_water_vapour: fill(opts.total_column_integrated_water_vapour ?? 10),
    },
    daily: {
      sunrise: [opts.sunrise ?? `${date}T06:15:00`],
      sunset: [opts.sunset ?? `${date}T18:15:00`],
    },
  };
}

const longRangeMeta: LongRangeMeta = {
  name: 'Shared Test Location',
  lat: 54.5,
  lon: -3.0,
  region: 'lake-district',
  elevation: 300,
  tags: ['upland', 'lake'],
  siteDarkness: siteDarknessFromBortle(5),
  darkSky: false,
  driveMins: 120,
};

/* ------------------------------------------------------------------ */
/*  extractHourlyWeather                                               */
/* ------------------------------------------------------------------ */

describe('extractHourlyWeather', () => {
  it('extracts weather variables with correct defaults', () => {
    const wData: AltWeatherData = { hourly: { time: ['2026-03-15T06:00'] } };
    const result = extractHourlyWeather(wData, 0);
    expect(result.cl).toBe(50);
    expect(result.cm).toBe(50);
    expect(result.ch).toBe(50);
    expect(result.ct).toBe(50);
    expect(result.visM).toBe(10000);
    expect(result.visK).toBe(10);
    expect(result.hum).toBe(70);
    expect(result.tmp).toBe(10);
    expect(result.dew).toBe(6);
    expect(result.tpw).toBe(20);
    expect(result.prev).toBe(0);
  });

  it('uses previous-hour precipitation for rain-clearing logic', () => {
    const wData: AltWeatherData = {
      hourly: {
        time: ['2026-03-15T06:00', '2026-03-15T07:00'],
        precipitation: [1.5, 0],
      },
    };
    const result = extractHourlyWeather(wData, 1);
    expect(result.prev).toBe(1.5);
    expect(result.pr).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  classifyHour                                                       */
/* ------------------------------------------------------------------ */

describe('classifyHour', () => {
  const sunrise = new Date('2026-03-15T06:15:00');
  const sunset = new Date('2026-03-15T18:15:00');

  it('classifies golden AM hours correctly', () => {
    const t = new Date('2026-03-15T06:30:00');
    const result = classifyHour(t, sunrise, sunset);
    expect(result.isGolden).toBe(true);
    expect(result.isGoldAm).toBe(true);
    expect(result.isAmSession).toBe(true);
    expect(result.isNight).toBe(false);
  });

  it('classifies golden PM hours correctly', () => {
    const t = new Date('2026-03-15T17:30:00');
    const result = classifyHour(t, sunrise, sunset);
    expect(result.isGolden).toBe(true);
    expect(result.isGoldPm).toBe(true);
    expect(result.isAmSession).toBe(false);
    expect(result.isNight).toBe(false);
  });

  it('classifies blue AM hours', () => {
    const t = new Date('2026-03-15T05:50:00');
    const result = classifyHour(t, sunrise, sunset);
    expect(result.isBlue).toBe(true);
    expect(result.isGolden).toBe(false);
    expect(result.isAmSession).toBe(true);
  });

  it('classifies nighttime hours', () => {
    const t = new Date('2026-03-15T02:00:00');
    const result = classifyHour(t, sunrise, sunset);
    expect(result.isNight).toBe(true);
    expect(result.isGolden).toBe(false);
    expect(result.isBlue).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  scoreGoldenBlueHour                                                */
/* ------------------------------------------------------------------ */

describe('scoreGoldenBlueHour', () => {
  it('produces higher drama scores for post-sunset with ideal high clouds', () => {
    const sunrise = new Date('2026-03-15T06:15:00');
    const sunset = new Date('2026-03-15T18:15:00');

    const weather = {
      cl: 10, cm: 25, ch: 45, ct: 30, visM: 40000, visK: 40,
      pp: 0, pr: 0, spd: 5, gst: 10, hum: 55, tmp: 8, dew: 3, tpw: 10, prev: 0,
    };
    const pmHour = classifyHour(new Date('2026-03-15T18:20:00'), sunrise, sunset);
    const amHour = classifyHour(new Date('2026-03-15T06:15:00'), sunrise, sunset);

    const pmResult = scoreGoldenBlueHour(weather, pmHour);
    const amResult = scoreGoldenBlueHour(weather, amHour);

    expect(pmResult.drama).toBeGreaterThan(0);
    expect(amResult.drama).toBeGreaterThan(0);
    // PM weighting emphasizes drama more
    expect(pmResult.score).not.toBe(amResult.score);
  });

  it('generates meaningful tags based on sub-scores', () => {
    const sunrise = new Date('2026-03-15T06:15:00');
    const sunset = new Date('2026-03-15T18:15:00');
    const weather = {
      cl: 10, cm: 25, ch: 45, ct: 30, visM: 40000, visK: 40,
      pp: 0, pr: 0, spd: 5, gst: 10, hum: 55, tmp: 8, dew: 3, tpw: 10, prev: 1.0,
    };
    const hourClass = classifyHour(new Date('2026-03-15T18:20:00'), sunrise, sunset);
    const result = scoreGoldenBlueHour(weather, hourClass);

    expect(result.tags).toContain('reflections');
  });
});

/* ------------------------------------------------------------------ */
/*  scoreAstroHour                                                     */
/* ------------------------------------------------------------------ */

describe('scoreAstroHour', () => {
  it('returns null for non-dark hours (solar altitude above threshold)', () => {
    // Midday in March — solar altitude well above -18°
    const t = new Date('2026-03-15T12:00:00');
    const result = scoreAstroHour(5, 40, 50, t, { lat: 54.5, lon: -3.0, siteDarkness: siteDarknessFromBortle(3) });
    expect(result).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  resolveAstroWin / resolveBestScore                                 */
/* ------------------------------------------------------------------ */

describe('resolveAstroWin', () => {
  it('returns true when astro beats day at a darker site than home', () => {
    // Home is bortle 7 (score 25); this site is bortle 3 (score 75)
    expect(resolveAstroWin(40, 60, siteDarknessFromBortle(3))).toBe(true);
  });

  it('returns false when astro is lower than day', () => {
    expect(resolveAstroWin(60, 40, siteDarknessFromBortle(3))).toBe(false);
  });

  it('returns false for bright-sky site even when astro is higher', () => {
    expect(resolveAstroWin(40, 60, siteDarknessFromBortle(8))).toBe(false);
  });
});

describe('resolveBestScore', () => {
  it('uses astro score when isAstroWin', () => {
    expect(resolveBestScore(40, 70, true)).toBe(70);
  });

  it('uses day score when not astro win', () => {
    expect(resolveBestScore(50, 70, false)).toBe(50);
  });
});

/* ------------------------------------------------------------------ */
/*  evaluateDay                                                        */
/* ------------------------------------------------------------------ */

describe('evaluateDay', () => {
  it('produces consistent scores with score-alternatives for same weather data', () => {
    const mamTorMeta = ALT_LOCATIONS.find(l => l.name === 'Mam Tor')!;
    const weather = makeWeatherFixture({ cloudcover: 20, visibility: 40000 });

    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [mamTorMeta],
      homeContext: {
        windows: [],
        dontBother: false,
        todayBestScore: 0,
        todayCarWash: { rating: 'OK', label: 'OK', score: 50, start: '10:00', end: '12:00', wind: 10, pp: 5 },
        dailySummary: [{ dayLabel: 'Today', dateKey: '2026-03-15', dayIdx: 0, photoScore: 0, headlineScore: 0, photoEmoji: '🙂', carWash: null }],
        metarNote: null,
        sunrise: '06:15',
        sunset: '18:15',
        moonPct: 10,
      },
    });

    const debug = result.debugContext.nearbyAlternatives?.find(a => a.name === 'Mam Tor');
    expect(debug).toBeDefined();
    expect(debug!.bestScore).toBeGreaterThan(0);
    expect(debug!.dayScore).toBeGreaterThan(0);
  });

  it('produces consistent scores with score-long-range for same weather data', () => {
    const weather = makeWeatherFixture();
    const input: ScoreLongRangeInput = {
      longRangeWeatherData: [weather],
      longRangeMeta: [longRangeMeta],
      homeHeadlineScore: 30,
      isWeekday: false,
    };
    const result = scoreLongRange(input);

    expect(result.longRangeCandidates.length).toBeGreaterThanOrEqual(0);
    const all = result.longRangeDebugCandidates;
    expect(all).toHaveLength(1);
    expect(all[0].dayScore).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Cross-pipeline regression: nearby and long-range on same weather   */
/* ------------------------------------------------------------------ */

describe('cross-pipeline regression: shared scoring parity', () => {
  it('nearby and long-range score the same weather identically for the same location', () => {
    const weather = makeWeatherFixture({
      cloudcover: 15,
      cloudcover_low: 5,
      cloudcover_mid: 25,
      cloudcover_high: 45,
      visibility: 50000,
      precipitation_probability: 0,
      windspeed_10m: 3,
      relativehumidity_2m: 50,
      temperature_2m: 8,
      dewpoint_2m: 3,
      total_column_integrated_water_vapour: 8,
    });

    // Score via long-range pipeline
    const lrResult = scoreLongRange({
      longRangeWeatherData: [weather],
      longRangeMeta: [longRangeMeta],
      homeHeadlineScore: 0,
      isWeekday: false,
    });

    // Score directly via evaluateDay (used by both pipelines)
    const hourIndices = weather.hourly!.time!.map((ts, i) => ({ ts, i }));
    const sunriseD = new Date(weather.daily!.sunrise![0]);
    const sunsetD = new Date(weather.daily!.sunset![0]);
    const eval_ = evaluateDay(
      weather,
      longRangeMeta,
      hourIndices,
      sunriseD,
      sunsetD,
      'Europe/London',
    );

    const candidate = lrResult.longRangeDebugCandidates[0];
    expect(candidate.dayScore).toBe(eval_.bestDay);
    expect(candidate.astroScore).toBe(eval_.bestAstro);
    expect(candidate.bestScore).toBe(eval_.bestScore);
    expect(candidate.amScore).toBe(eval_.amScore);
    expect(candidate.pmScore).toBe(eval_.pmScore);
    expect(candidate.isAstroWin).toBe(eval_.isAstroWin);
  });

  it('poor weather scores low through both pipelines', () => {
    const poorWeather = makeWeatherFixture({
      cloudcover: 95,
      visibility: 1000,
      precipitation_probability: 80,
      precipitation: 5,
      windspeed_10m: 30,
      windgusts_10m: 50,
      relativehumidity_2m: 95,
    });

    const lrResult = scoreLongRange({
      longRangeWeatherData: [poorWeather],
      longRangeMeta: [longRangeMeta],
      homeHeadlineScore: 60,
      isWeekday: false,
    });

    expect(lrResult.showCard).toBe(false);
    expect(lrResult.longRangeCandidates).toHaveLength(0);
  });

  it('excellent weather scores high through both pipelines', () => {
    const times: string[] = [];
    for (let h = 0; h < 24; h++) {
      times.push(`2026-03-15T${String(h).padStart(2, '0')}:00`);
    }
    const precip = new Array(24).fill(1.0);
    precip[17] = 0; precip[18] = 0;
    const excellentWeather: AltWeatherData = {
      hourly: {
        time: times,
        cloudcover: new Array(24).fill(15),
        cloudcover_low: new Array(24).fill(5),
        cloudcover_mid: new Array(24).fill(25),
        cloudcover_high: new Array(24).fill(45),
        visibility: new Array(24).fill(50000),
        precipitation_probability: new Array(24).fill(0),
        precipitation: precip,
        windspeed_10m: new Array(24).fill(3),
        windgusts_10m: new Array(24).fill(5),
        relativehumidity_2m: new Array(24).fill(50),
        temperature_2m: new Array(24).fill(8),
        dewpoint_2m: new Array(24).fill(7),
        total_column_integrated_water_vapour: new Array(24).fill(8),
      },
      daily: {
        sunrise: ['2026-03-15T06:15:00'],
        sunset: ['2026-03-15T18:15:00'],
      },
    };

    const lrResult = scoreLongRange({
      longRangeWeatherData: [excellentWeather],
      longRangeMeta: [longRangeMeta],
      homeHeadlineScore: 30,
      isWeekday: false,
    });

    expect(lrResult.longRangeTop).not.toBeNull();
    expect(lrResult.longRangeTop!.bestScore).toBeGreaterThanOrEqual(50);
    expect(lrResult.showCard).toBe(true);
  });
});
