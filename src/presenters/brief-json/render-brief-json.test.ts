import { describe, expect, it } from 'vitest';
import { renderBriefAsJson } from './render-brief-json.js';
import { BRIEF_JSON_SCHEMA_VERSION } from '../../contracts/index.js';
import type { EditorialDecision } from '../../app/run-photo-brief/contracts.js';
import type { ScoredForecastContext } from '../../contracts/index.js';

function makeScoredContext(): ScoredForecastContext {
  return {
    dontBother: false,
    windows: [],
    todayCarWash: {
      label: 'Great',
      score: 80,
      rating: 'YES',
      start: '06:00',
      end: '08:00',
      wind: 8,
      pp: 5,
      tmp: 7,
    },
    dailySummary: [],
    altLocations: [],
    noAltsMsg: null,
    sunriseStr: '06:18',
    sunsetStr: '18:11',
    moonPct: 8,
    metarNote: '',
    sessionRecommendation: {
      primary: {
        session: 'storm',
        hourLabel: '19:00',
        score: 84,
        hardPass: true,
        confidence: 'high',
        volatility: 18,
        reasons: ['Cloud structure and illumination already look storm-friendly.'],
        warnings: [],
        requiredCapabilities: ['cloud-stratification', 'precipitation', 'wind', 'aerosols', 'sun-geometry', 'upper-air'],
      },
      runnerUps: [],
      bySession: [],
      hoursAnalyzed: 8,
    },
    today: 'Wednesday 18 March',
    todayBestScore: 60,
    shSunsetQ: null,
    shSunriseQ: null,
    shSunsetText: null,
    sunDir: null,
    crepPeak: 0,
    peakKpTonight: 6.3,
    auroraSignal: null,
    debugContext: {
      metadata: {
        generatedAt: '2026-03-18T06:30:44.082Z',
        location: 'Leeds',
        latitude: 53.82703,
        longitude: -1.570755,
        timezone: 'Europe/London',
        debugModeEnabled: false,
      },
      hourlyScoring: [],
      windows: [],
      nearbyAlternatives: [],
    },
  };
}

function makeEditorialDecision(): EditorialDecision {
  return {
    primaryProvider: 'primary',
    selectedProvider: 'primary',
    fallbackUsed: false,
    aiText: 'Conditions improve through the local astro slot.',
    compositionBullets: ['Face north.'],
    weekInsight: 'Today is the most reliable forecast.',
    spurOfTheMoment: null,
    geminiInspire: 'Look for reflected light on wet stone.',
  };
}

describe('renderBriefAsJson', () => {
  it('returns the shared JSON contract with schema and metadata', () => {
    const result = renderBriefAsJson(makeScoredContext(), makeEditorialDecision());

    expect(result.schemaVersion).toBe(BRIEF_JSON_SCHEMA_VERSION);
    expect(result.generatedAt).toBe('2026-03-18T06:30:44.082Z');
    expect(result.location).toEqual({
      name: 'Leeds',
      timezone: 'Europe/London',
      latitude: 53.82703,
      longitude: -1.570755,
    });
    expect(result.aiText).toBe('Conditions improve through the local astro slot.');
    expect(result.compositionBullets).toEqual(['Face north.']);
    expect(result.weekInsight).toBe('Today is the most reliable forecast.');
    expect(result.geminiInspire).toBe('Look for reflected light on wet stone.');
    expect(result.sessionRecommendation?.primary?.session).toBe('storm');
    expect(result.sessionRecommendation?.hoursAnalyzed).toBe(8);
  });

  it('does not leak non-contract runtime fields into the JSON payload', () => {
    const rawContext = {
      ...makeScoredContext(),
      debugMode: true,
      debugEmailTo: 'debug@example.com',
    } as ScoredForecastContext & { debugMode: boolean; debugEmailTo: string };

    const result = renderBriefAsJson(rawContext, makeEditorialDecision()) as unknown as Record<string, unknown>;

    expect(result.debugMode).toBeUndefined();
    expect(result.debugEmailTo).toBeUndefined();
  });
});
