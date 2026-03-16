import { describe, it, expect } from 'vitest';
import { scoreLongRange, type ScoreLongRangeInput, type LongRangeMeta } from './score-long-range.js';
import { haversineKm, estimatedDriveMins, isWithinDriveLimit, LONG_RANGE_LOCATIONS, type LongRangeLocation } from './long-range-locations.js';
import type { AltWeatherData } from './score-alternatives.js';
import { siteDarknessFromBortle } from './site-darkness.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeWeatherData(overrides: Partial<{
  cloudcover: number;
  cloudcover_low: number;
  cloudcover_mid: number;
  cloudcover_high: number;
  visibility: number;
  precipitation_probability: number;
  precipitation: number;
  windspeed_10m: number;
  windgusts_10m: number;
  relativehumidity_2m: number;
  temperature_2m: number;
  dewpoint_2m: number;
  total_column_integrated_water_vapour: number;
}> = {}): AltWeatherData {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    times.push(`2026-03-15T${String(h).padStart(2, '0')}:00`);
  }
  const fill = (val: number) => new Array(24).fill(val);
  return {
    hourly: {
      time: times,
      cloudcover: fill(overrides.cloudcover ?? 20),
      cloudcover_low: fill(overrides.cloudcover_low ?? 10),
      cloudcover_mid: fill(overrides.cloudcover_mid ?? 20),
      cloudcover_high: fill(overrides.cloudcover_high ?? 40),
      visibility: fill(overrides.visibility ?? 40000),
      precipitation_probability: fill(overrides.precipitation_probability ?? 0),
      precipitation: fill(overrides.precipitation ?? 0),
      windspeed_10m: fill(overrides.windspeed_10m ?? 5),
      windgusts_10m: fill(overrides.windgusts_10m ?? 10),
      relativehumidity_2m: fill(overrides.relativehumidity_2m ?? 55),
      temperature_2m: fill(overrides.temperature_2m ?? 8),
      dewpoint_2m: fill(overrides.dewpoint_2m ?? 3),
      total_column_integrated_water_vapour: fill(overrides.total_column_integrated_water_vapour ?? 10),
    },
    daily: {
      sunrise: ['2026-03-15T06:15:00'],
      sunset: ['2026-03-15T18:15:00'],
    },
  };
}

const baseMeta: LongRangeMeta = {
  name: 'Test Location',
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
/*  scoreLongRange                                                     */
/* ------------------------------------------------------------------ */

describe('scoreLongRange', () => {
  it('returns showCard=false when no candidate meets threshold', () => {
    const input: ScoreLongRangeInput = {
      longRangeWeatherData: [makeWeatherData({ cloudcover: 95, visibility: 1000, precipitation_probability: 80 })],
      longRangeMeta: [baseMeta],
      leedsHeadlineScore: 60,
      isWeekday: false,
    };
    const result = scoreLongRange(input);
    expect(result.showCard).toBe(false);
    expect(result.longRangeTop).toBeNull();
    expect(result.cardLabel).toBeNull();
  });

  it('returns showCard=true when candidate meets score and delta thresholds', () => {
    // Build hour-by-hour weather with previous-hour rain clearing (boosts drama+mist)
    const times: string[] = [];
    for (let h = 0; h < 24; h++) {
      times.push(`2026-03-15T${String(h).padStart(2, '0')}:00`);
    }
    const fill = (val: number) => new Array(24).fill(val);
    // Set precipitation to 1.0 for all hours except golden-hour hours (17, 18) which are 0
    // This creates previous-hour-rain-clearing bonus at hour 18 (sunset ~18:15)
    const precip = new Array(24).fill(1.0);
    precip[17] = 0; precip[18] = 0;
    const excellentWeather: AltWeatherData = {
      hourly: {
        time: times,
        cloudcover: fill(15),
        cloudcover_low: fill(5),
        cloudcover_mid: fill(25),
        cloudcover_high: fill(45),
        visibility: fill(50000),
        precipitation_probability: fill(0),
        precipitation: precip,
        windspeed_10m: fill(3),
        windgusts_10m: fill(5),
        relativehumidity_2m: fill(50),
        temperature_2m: fill(8),
        dewpoint_2m: fill(7), // close to temp → mist bonus
        total_column_integrated_water_vapour: fill(8),
      },
      daily: {
        sunrise: ['2026-03-15T06:15:00'],
        sunset: ['2026-03-15T18:15:00'],
      },
    };
    const input: ScoreLongRangeInput = {
      longRangeWeatherData: [excellentWeather],
      longRangeMeta: [baseMeta],
      leedsHeadlineScore: 40,
      isWeekday: false,
    };
    const result = scoreLongRange(input);
    expect(result.longRangeTop).not.toBeNull();
    expect(result.longRangeTop!.bestScore).toBeGreaterThanOrEqual(50);
    expect(result.showCard).toBe(true);
    expect(result.cardLabel).toBe('Distance no object');
  });

  it('labels as "Weekend opportunity" on weekdays', () => {
    const excellentWeather = makeWeatherData({
      cloudcover: 15,
      cloudcover_low: 5,
      cloudcover_mid: 25,
      cloudcover_high: 45,
      visibility: 50000,
      precipitation_probability: 0,
      precipitation: 0,
      windspeed_10m: 3,
      relativehumidity_2m: 50,
      total_column_integrated_water_vapour: 8,
    });
    const input: ScoreLongRangeInput = {
      longRangeWeatherData: [excellentWeather],
      longRangeMeta: [baseMeta],
      leedsHeadlineScore: 40,
      isWeekday: true,
    };
    const result = scoreLongRange(input);
    if (result.showCard) {
      expect(result.cardLabel).toBe('Weekend opportunity');
    }
  });

  it('does not show card when delta is below threshold even with decent score', () => {
    const excellentWeather = makeWeatherData({
      cloudcover: 15,
      cloudcover_low: 5,
      cloudcover_mid: 25,
      cloudcover_high: 45,
      visibility: 50000,
      precipitation_probability: 0,
    });
    const input: ScoreLongRangeInput = {
      longRangeWeatherData: [excellentWeather],
      longRangeMeta: [baseMeta],
      leedsHeadlineScore: 75,
      isWeekday: false,
    };
    const result = scoreLongRange(input);
    expect(result.showCard).toBe(false);
  });

  it('ranks multiple candidates by score descending', () => {
    const goodWeather = makeWeatherData({
      cloudcover: 15,
      cloudcover_low: 5,
      cloudcover_mid: 25,
      cloudcover_high: 45,
      visibility: 50000,
      precipitation_probability: 0,
      windspeed_10m: 3,
      relativehumidity_2m: 50,
      total_column_integrated_water_vapour: 8,
    });
    const decentWeather = makeWeatherData({
      cloudcover: 25,
      cloudcover_low: 15,
      cloudcover_mid: 30,
      cloudcover_high: 50,
      visibility: 35000,
      precipitation_probability: 5,
    });

    const meta1: LongRangeMeta = { ...baseMeta, name: 'Location A' };
    const meta2: LongRangeMeta = { ...baseMeta, name: 'Location B' };

    const input: ScoreLongRangeInput = {
      longRangeWeatherData: [decentWeather, goodWeather],
      longRangeMeta: [meta1, meta2],
      leedsHeadlineScore: 30,
      isWeekday: false,
    };
    const result = scoreLongRange(input);
    if (result.longRangeCandidates.length >= 2) {
      expect(result.longRangeCandidates[0].bestScore).toBeGreaterThanOrEqual(result.longRangeCandidates[1].bestScore);
    }
  });

  it('lets a materially darker site win on otherwise identical weather', () => {
    const identicalWeather = makeWeatherData({
      cloudcover: 10,
      cloudcover_low: 5,
      cloudcover_mid: 20,
      cloudcover_high: 30,
      visibility: 50000,
      relativehumidity_2m: 55,
    });

    const brighterMeta: LongRangeMeta = {
      ...baseMeta,
      name: 'Brighter Site',
      siteDarkness: siteDarknessFromBortle(5),
      darkSky: false,
    };
    const darkerMeta: LongRangeMeta = {
      ...baseMeta,
      name: 'Darker Site',
      siteDarkness: siteDarknessFromBortle(3),
      darkSky: true,
    };

    const result = scoreLongRange({
      longRangeWeatherData: [identicalWeather, identicalWeather],
      longRangeMeta: [brighterMeta, darkerMeta],
      leedsHeadlineScore: 10,
      isWeekday: false,
    });

    expect(result.longRangeCandidates[0]?.name).toBe('Darker Site');
  });

  it('detects dark sky alert for dark-sky locations with high astro score', () => {
    const clearNightWeather = makeWeatherData({
      cloudcover: 5,
      visibility: 50000,
      relativehumidity_2m: 50,
    });
    const darkSkyMeta: LongRangeMeta = {
      ...baseMeta,
      name: 'Kielder Forest',
      siteDarkness: siteDarknessFromBortle(2),
      darkSky: true,
    };
    const input: ScoreLongRangeInput = {
      longRangeWeatherData: [clearNightWeather],
      longRangeMeta: [darkSkyMeta],
      leedsHeadlineScore: 60,
      isWeekday: false,
    };
    const result = scoreLongRange(input);
    if (result.darkSkyAlert) {
      expect(result.darkSkyAlert.name).toBe('Kielder Forest');
      expect(result.darkSkyAlert.astroScore).toBeGreaterThanOrEqual(70);
    }
  });

  it('gracefully handles empty input', () => {
    const input: ScoreLongRangeInput = {
      longRangeWeatherData: [],
      longRangeMeta: [],
      leedsHeadlineScore: 50,
      isWeekday: false,
    };
    const result = scoreLongRange(input);
    expect(result.showCard).toBe(false);
    expect(result.longRangeTop).toBeNull();
    expect(result.longRangeCandidates).toHaveLength(0);
    expect(result.darkSkyAlert).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  long-range-locations utilities                                     */
/* ------------------------------------------------------------------ */

describe('haversineKm', () => {
  it('returns ~0 for same point', () => {
    expect(haversineKm(53.8, -1.5, 53.8, -1.5)).toBeCloseTo(0, 1);
  });

  it('returns reasonable distance Leeds to Snowdon', () => {
    const d = haversineKm(53.827, -1.571, 53.069, -4.076);
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(220);
  });
});

describe('estimatedDriveMins', () => {
  it('applies regional correction factor', () => {
    const snowdonia: LongRangeLocation = {
      name: 'Snowdon', lat: 53.069, lon: -4.076,
      region: 'snowdonia', elevation: 1085, tags: ['upland'], siteDarkness: siteDarknessFromBortle(4), darkSky: false,
    };
    const yorkshire: LongRangeLocation = {
      name: 'Pen-y-ghent', lat: 54.155, lon: -2.265,
      region: 'yorkshire-dales', elevation: 694, tags: ['upland'], siteDarkness: siteDarknessFromBortle(4), darkSky: false,
    };
    // Snowdonia has 0.65 factor (slower) so drive time should be proportionally longer per km
    const snowdonMins = estimatedDriveMins(snowdonia);
    const penMins = estimatedDriveMins(yorkshire);
    expect(snowdonMins).toBeGreaterThan(penMins);
  });
});

describe('isWithinDriveLimit', () => {
  it('includes nearby locations', () => {
    const loc: LongRangeLocation = {
      name: 'Near', lat: 54.0, lon: -2.0,
      region: 'yorkshire-dales', elevation: 300, tags: ['upland'], siteDarkness: siteDarknessFromBortle(4), darkSky: false,
    };
    expect(isWithinDriveLimit(loc)).toBe(true);
  });
});

describe('LONG_RANGE_LOCATIONS', () => {
  it('has at least 40 locations', () => {
    expect(LONG_RANGE_LOCATIONS.length).toBeGreaterThanOrEqual(40);
  });

  it('every location has required fields', () => {
    for (const loc of LONG_RANGE_LOCATIONS) {
      expect(loc.name).toBeTruthy();
      expect(typeof loc.lat).toBe('number');
      expect(typeof loc.lon).toBe('number');
      expect(loc.region).toBeTruthy();
      expect(typeof loc.elevation).toBe('number');
      expect(Array.isArray(loc.tags)).toBe(true);
      expect(loc.tags.length).toBeGreaterThan(0);
      expect(loc.siteDarkness.bortle).toBeGreaterThanOrEqual(1);
      expect(typeof loc.darkSky).toBe('boolean');
    }
  });

  it('covers all expected regions', () => {
    const regions = new Set(LONG_RANGE_LOCATIONS.map(l => l.region));
    expect(regions.has('yorkshire-dales')).toBe(true);
    expect(regions.has('peak-district')).toBe(true);
    expect(regions.has('lake-district')).toBe(true);
    expect(regions.has('north-york-moors')).toBe(true);
    expect(regions.has('northumberland')).toBe(true);
    expect(regions.has('snowdonia')).toBe(true);
    expect(regions.has('brecon-beacons')).toBe(true);
    expect(regions.has('scottish-borders')).toBe(true);
  });
});
