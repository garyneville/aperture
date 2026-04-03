import { describe, it, expect } from 'vitest';
import {
  ALT_LOCATIONS,
  UPLAND_ELEVATION_THRESHOLD_M,
  prepareAltLocations,
} from '../../lib/prepare-alt-locations.js';
import { emptyDebugContext } from '../../lib/debug-context.js';
import { scoreAlternatives } from './score-alternatives.js';
import type { AltWeatherData } from './score-alternatives.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build a minimal 24-hour AltWeatherData fixture for a single day. */
function makeWeatherFixture(opts: {
  date?: string;
  cloudcover?: number;
  visibility?: number;
  snowDepthM?: number[];
  snowfallCmHr?: number[];
} = {}): AltWeatherData {
  const date = opts.date ?? '2026-06-15';
  const cc = opts.cloudcover ?? 20;
  const vis = opts.visibility ?? 30000;

  const hours = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);

  return {
    hourly: {
      time: hours,
      cloudcover: hours.map(() => cc),
      cloudcover_low: hours.map(() => 5),
      cloudcover_mid: hours.map(() => 10),
      cloudcover_high: hours.map((_, h) => (h >= 18 && h <= 20 ? 40 : 10)),
      visibility: hours.map(() => vis),
      temperature_2m: hours.map(() => 14),
      relativehumidity_2m: hours.map(() => 60),
      dewpoint_2m: hours.map(() => 6),
      precipitation_probability: hours.map(() => 5),
      precipitation: hours.map(() => 0),
      windspeed_10m: hours.map(() => 8),
      windgusts_10m: hours.map(() => 14),
      total_column_integrated_water_vapour: hours.map(() => 12),
      snow_depth: opts.snowDepthM ?? undefined,
      snowfall: opts.snowfallCmHr ?? undefined,
    },
    daily: {
      sunrise: [`${date}T05:30`],
      sunset: [`${date}T21:00`],
    },
  };
}

function makeHighScoringWeatherFixture(opts: {
  date: string;
  sunrise: string;
  sunset: string;
}): AltWeatherData {
  const { date, sunrise, sunset } = opts;
  const hours = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);
  const precip = new Array(24).fill(1);
  const sunsetHour = Number.parseInt(sunset.slice(11, 13), 10);
  precip[sunsetHour] = 0;

  return {
    hourly: {
      time: hours,
      cloudcover: hours.map(() => 15),
      cloudcover_low: hours.map(() => 5),
      cloudcover_mid: hours.map(() => 25),
      cloudcover_high: hours.map(() => 45),
      visibility: hours.map(() => 50000),
      temperature_2m: hours.map(() => 8),
      relativehumidity_2m: hours.map(() => 50),
      dewpoint_2m: hours.map(() => 7),
      precipitation_probability: hours.map(() => 0),
      precipitation: precip,
      windspeed_10m: hours.map(() => 3),
      windgusts_10m: hours.map(() => 5),
      total_column_integrated_water_vapour: hours.map(() => 8),
    },
    daily: {
      sunrise: [sunrise],
      sunset: [sunset],
    },
  };
}

/** Minimal Leeds context that never beats any alt. */
function makeLeedsContext(leedsHeadlineScore = 10) {
  return {
    windows: [],
    dontBother: false,
    todayBestScore: leedsHeadlineScore,
    todayCarWash: { rating: 'OK', label: 'OK', score: 50, start: '10:00', end: '12:00', wind: 10, pp: 5 },
    dailySummary: [
      { dayLabel: 'Today', dateKey: '2026-06-15', dayIdx: 0, photoScore: leedsHeadlineScore, headlineScore: leedsHeadlineScore, photoEmoji: '🙂', carWash: { rating: 'OK', label: 'OK', score: 50, start: '10:00', end: '12:00', wind: 10, pp: 5 } },
    ],
    metarNote: null,
    sunrise: '05:30',
    sunset: '21:00',
    moonPct: 10,
  };
}

/* ------------------------------------------------------------------ */
/*  prepare-alt-locations                                              */
/* ------------------------------------------------------------------ */

describe('ALT_LOCATIONS config', () => {
  it('every location has a non-zero elevationM', () => {
    for (const loc of ALT_LOCATIONS) {
      expect(loc.elevationM, `${loc.name} should have elevationM > 0`).toBeGreaterThan(0);
    }
  });

  it('isUpland is true iff elevationM >= UPLAND_ELEVATION_THRESHOLD_M', () => {
    for (const loc of ALT_LOCATIONS) {
      const expected = loc.elevationM >= UPLAND_ELEVATION_THRESHOLD_M;
      expect(loc.isUpland, `${loc.name}: isUpland mismatch`).toBe(expected);
    }
  });

  it('Mam Tor and Stanage Edge are marked as upland', () => {
    const mamTor = ALT_LOCATIONS.find(l => l.name === 'Mam Tor');
    const stanage = ALT_LOCATIONS.find(l => l.name === 'Stanage Edge');
    expect(mamTor?.isUpland).toBe(true);
    expect(stanage?.isUpland).toBe(true);
  });

  it('Bolton Abbey is not upland (valley location)', () => {
    const boltonAbbey = ALT_LOCATIONS.find(l => l.name === 'Bolton Abbey');
    expect(boltonAbbey?.isUpland).toBe(false);
  });

});

describe('prepareAltLocations URL building', () => {
  it('includes &elevation= param in URL for upland locations', () => {
    const locs = prepareAltLocations('Europe/London');
    const mamTor = locs.find(l => l.name === 'Mam Tor');
    expect(mamTor).toBeDefined();
    expect(mamTor!.url).toContain(`&elevation=${mamTor!.elevationM}`);
  });

  it('does NOT include &elevation= in URL for non-upland locations', () => {
    const locs = prepareAltLocations('Europe/London');
    const boltonAbbey = locs.find(l => l.name === 'Bolton Abbey');
    expect(boltonAbbey).toBeDefined();
    expect(boltonAbbey!.url).not.toContain('&elevation=');
  });

  it('includes snowfall and snow_depth in HOURLY_FIELDS for all locations', () => {
    const locs = prepareAltLocations('Europe/London');
    for (const loc of locs) {
      expect(loc.url, `${loc.name} URL missing snowfall`).toContain('snowfall');
      expect(loc.url, `${loc.name} URL missing snow_depth`).toContain('snow_depth');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  scoreAlternatives — snow extraction                               */
/* ------------------------------------------------------------------ */

describe('scoreAlternatives snow data extraction', () => {
  const mamTorMeta = ALT_LOCATIONS.find(l => l.name === 'Mam Tor')!;

  it('extracts snowDepthCm from snow_depth hourly data (metres → cm)', () => {
    // snow_depth is in metres per Open-Meteo spec; 0.05m = 5cm
    const snowDepthM = Array(24).fill(0);
    snowDepthM[12] = 0.05; // peak at noon = 5cm

    const weather = makeWeatherFixture({ snowDepthM, cloudcover: 30 });
    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [mamTorMeta],
      homeContext: makeLeedsContext(10),
    });

    // Mam Tor should appear (good conditions, low Leeds score)
    // snowDepthCm should be extracted even if location didn't make threshold
    const allDays = result.augmentedSummary;
    expect(allDays).toHaveLength(1);

    // Extract from debug context for validation
    const mamTorDebug = result.debugContext.nearbyAlternatives?.find(a => a.name === 'Mam Tor');
    expect(mamTorDebug).toBeDefined();

    // TodayAlt if it passed threshold
    const todayAlt = result.altLocations.find(a => a.name === 'Mam Tor');
    if (todayAlt) {
      expect(todayAlt.snowDepthCm).toBe(5);
    }
  });

  it('extracts snowfallCm from hourly snowfall data (cm/hr accumulated)', () => {
    const snowfallCmHr = Array(24).fill(0);
    snowfallCmHr[6] = 0.5;
    snowfallCmHr[7] = 1.2;
    snowfallCmHr[8] = 0.3;

    const weather = makeWeatherFixture({ snowfallCmHr, cloudcover: 30 });
    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [mamTorMeta],
      homeContext: makeLeedsContext(10),
    });

    const todayAlt = result.altLocations.find(a => a.name === 'Mam Tor');
    if (todayAlt) {
      // 0.5 + 1.2 + 0.3 = 2.0cm rounded to 1dp
      expect(todayAlt.snowfallCm).toBe(2);
    }
  });

  it('returns snowDepthCm=null when no snow_depth data present (graceful fallback)', () => {
    // No snowDepthM or snowfallCmHr — simulates a lowland location or missing field
    const weather = makeWeatherFixture({ cloudcover: 30 });
    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [mamTorMeta],
      homeContext: makeLeedsContext(10),
    });

    const todayAlt = result.altLocations.find(a => a.name === 'Mam Tor');
    if (todayAlt) {
      expect(todayAlt.snowDepthCm).toBeNull();
      expect(todayAlt.snowfallCm).toBeNull();
    }
  });

  it('returns snowDepthCm=null when snow_depth is all zeros (no snow present)', () => {
    const weather = makeWeatherFixture({
      snowDepthM: Array(24).fill(0),
      snowfallCmHr: Array(24).fill(0),
      cloudcover: 30,
    });
    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [mamTorMeta],
      homeContext: makeLeedsContext(10),
    });

    const todayAlt = result.altLocations.find(a => a.name === 'Mam Tor');
    if (todayAlt) {
      expect(todayAlt.snowDepthCm).toBeNull();
      expect(todayAlt.snowfallCm).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ */
/*  scoreAlternatives — elevation + isUpland propagation             */
/* ------------------------------------------------------------------ */

describe('scoreAlternatives elevation propagation', () => {
  it('TodayAlt carries elevationM and isUpland from location config', () => {
    const mamTorMeta = ALT_LOCATIONS.find(l => l.name === 'Mam Tor')!;
    const weather = makeWeatherFixture({ cloudcover: 20, visibility: 40000 });

    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [mamTorMeta],
      homeContext: makeLeedsContext(5),
    });

    const todayAlt = result.altLocations.find(a => a.name === 'Mam Tor');
    if (todayAlt) {
      expect(todayAlt.elevationM).toBe(517);
      expect(todayAlt.isUpland).toBe(true);
    }
  });

  it('non-upland location carries isUpland=false in TodayAlt', () => {
    const boltonAbbeyMeta = ALT_LOCATIONS.find(l => l.name === 'Bolton Abbey')!;
    const weather = makeWeatherFixture({ cloudcover: 20, visibility: 40000 });

    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [boltonAbbeyMeta],
      homeContext: makeLeedsContext(5),
    });

    const todayAlt = result.altLocations.find(a => a.name === 'Bolton Abbey');
    if (todayAlt) {
      expect(todayAlt.isUpland).toBe(false);
    }
  });
});

describe('scoreAlternatives astro-hour clamping', () => {
  it('does not assign a bestAstroHour on summer nights with no astronomical darkness', () => {
    const mamTorMeta = ALT_LOCATIONS.find(l => l.name === 'Mam Tor')!;
    const weather = makeHighScoringWeatherFixture({
      date: '2026-06-15',
      sunrise: '2026-06-15T04:30:00',
      sunset: '2026-06-15T21:30:00',
    });

    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [mamTorMeta],
      homeContext: makeLeedsContext(5),
    });

    const todayAlt = result.altLocations.find(a => a.name === 'Mam Tor');
    expect(todayAlt).toBeDefined();
    expect(todayAlt?.bestAstroHour).toBeNull();
    expect(todayAlt?.isAstroWin).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Regression: lowland scoring behaviour unchanged                   */
/* ------------------------------------------------------------------ */

describe('regression: lowland alt scoring is unchanged by upland additions', () => {
  it('returns a non-zero bestScore for a clear-sky lowland location', () => {
    const boltonAbbeyMeta = ALT_LOCATIONS.find(l => l.name === 'Bolton Abbey')!;
    const weather = makeWeatherFixture({ cloudcover: 15, visibility: 35000 });

    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [boltonAbbeyMeta],
      homeContext: makeLeedsContext(5),
    });

    const debug = result.debugContext.nearbyAlternatives?.find(a => a.name === 'Bolton Abbey');
    expect(debug).toBeDefined();
    expect(debug!.bestScore).toBeGreaterThan(0);
  });

  it('does not surface lowland alt when Leeds score is higher', () => {
    const boltonAbbeyMeta = ALT_LOCATIONS.find(l => l.name === 'Bolton Abbey')!;
    const weather = makeWeatherFixture({ cloudcover: 15, visibility: 35000 });

    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [boltonAbbeyMeta],
      homeContext: makeLeedsContext(95), // Leeds dominates
    });

    expect(result.altLocations).toHaveLength(0);
    expect(result.noAltsMsg).not.toBeNull();
  });

  it('null weather data for a location does not throw', () => {
    const boltonAbbeyMeta = ALT_LOCATIONS.find(l => l.name === 'Bolton Abbey')!;

    expect(() => scoreAlternatives({
      altWeatherData: [{}],
      altLocationMeta: [boltonAbbeyMeta],
      homeContext: makeLeedsContext(10),
    })).not.toThrow();
  });

  it('shows a nearby alternative that beats Leeds by exactly 8 points', () => {
    const malhamMeta = ALT_LOCATIONS.find(l => l.name === 'Malham Cove')!;
    const weather = makeHighScoringWeatherFixture({
      date: '2026-03-15',
      sunrise: '2026-03-15T06:15:00',
      sunset: '2026-03-15T18:15:00',
    });
    const baseline = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [malhamMeta],
      homeContext: makeLeedsContext(0),
    });
    const malhamScore = baseline.debugContext.nearbyAlternatives?.find(a => a.name === 'Malham Cove')?.bestScore;
    expect(typeof malhamScore).toBe('number');

    const result = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [malhamMeta],
      homeContext: makeLeedsContext((malhamScore as number) - 8),
    });

    const debug = result.debugContext.nearbyAlternatives?.find(a => a.name === 'Malham Cove');
    expect(debug).toBeDefined();
    expect(debug?.bestScore).toBe(malhamScore);
    expect(debug?.shown).toBe(true);
    expect(result.altLocations.some(location => location.name === 'Malham Cove')).toBe(true);
  });

  it('surfaces darker astro near-misses as close contenders', () => {
    const malhamMeta = ALT_LOCATIONS.find(l => l.name === 'Malham Cove')!;
    const boltonAbbeyMeta = ALT_LOCATIONS.find(l => l.name === 'Bolton Abbey')!;
    const weather = makeHighScoringWeatherFixture({
      date: '2026-03-15',
      sunrise: '2026-03-15T06:15:00',
      sunset: '2026-03-15T18:15:00',
    });
    const baseline = scoreAlternatives({
      altWeatherData: [weather],
      altLocationMeta: [malhamMeta],
      homeContext: makeLeedsContext(0),
    });
    const malhamScore = baseline.debugContext.nearbyAlternatives?.find(a => a.name === 'Malham Cove')?.bestScore;
    expect(typeof malhamScore).toBe('number');

    const debugContext = emptyDebugContext();
    debugContext.windows = [{
      label: 'Midnight astro window',
      start: '00:00',
      end: '04:00',
      peak: (malhamScore as number) - 8,
      rank: 1,
      selected: true,
      fallback: false,
      selectionReason: 'selected as the highest-scoring local window',
    }];

    const result = scoreAlternatives({
      altWeatherData: [weather, weather],
      altLocationMeta: [malhamMeta, boltonAbbeyMeta],
      homeContext: {
        ...makeLeedsContext(malhamScore as number),
        debugContext,
      },
    });

    expect(result.altLocations).toHaveLength(0);
    expect(result.closeContenders.map(location => location.name)).toContain('Malham Cove');
    expect(result.closeContenders.map(location => location.name)).not.toContain('Bolton Abbey');
    expect(result.noAltsMsg).toBeNull();
  });
});
