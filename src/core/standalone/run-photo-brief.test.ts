import { describe, expect, it } from 'vitest';
import { runPhotoBrief } from './run-photo-brief.js';
import { renderBriefAsJson } from '../../renderers/brief-json.js';
import { BRIEF_JSON_SCHEMA_VERSION } from '../../types/brief.js';
import type {
  EditorialDecision,
  EditorialRequest,
  ForecastBundle,
  RenderedOutputs,
  ScoredForecastContext,
  StandaloneBriefRun,
} from './contracts.js';

function makeForecastBundle(): ForecastBundle {
  return {
    generatedAt: '2026-03-18T06:30:00.000Z',
    location: {
      name: 'Leeds',
      lat: 53.82703,
      lon: -1.570755,
      timezone: 'Europe/London',
      icao: 'EGNM',
    },
    providerPayloads: {
      weather: { source: 'open-meteo' },
      metar: { source: 'aviationweather' },
      aurora: { source: 'aurorawatch' },
    },
  };
}

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
      hourlyScoring: [],
      windows: [],
      nearbyAlternatives: [],
    },
  };
}

function makeEditorialRequest(context: ScoredForecastContext): EditorialRequest {
  return {
    prompt: 'Respond with a short editorial summary.',
    context,
  };
}

function makeEditorialDecision(): EditorialDecision {
  return {
    primaryProvider: 'gemini',
    selectedProvider: 'gemini',
    fallbackUsed: false,
    aiText: 'Conditions improve through the local astro slot; a clear northern horizon is worth keeping in play.',
    compositionBullets: ['Face north with a low ridge and leave space for any aurora structure.'],
    weekInsight: 'Today is the most reliable forecast.',
    spurOfTheMoment: null,
    rawGeminiResponse: '{"editorial":"..."}',
  };
}

function makeOutputs(): RenderedOutputs {
  return {
    briefJson: renderBriefAsJson(makeScoredContext(), makeEditorialDecision()),
    telegramMsg: 'telegram',
    emailHtml: '<p>email</p>',
    debugEmailHtml: '<p>debug</p>',
    debugEmailSubject: 'Debug subject',
  };
}

describe('runPhotoBrief', () => {
  it('assembles a standalone run artifact in stage order', async () => {
    const calls: string[] = [];
    const persistedRuns: StandaloneBriefRun[] = [];
    const deliveredRuns: StandaloneBriefRun[] = [];
    const forecast = makeForecastBundle();
    const scoredContext = makeScoredContext();
    const editorialRequest = makeEditorialRequest(scoredContext);
    const editorial = makeEditorialDecision();
    const outputs = makeOutputs();

    const result = await runPhotoBrief({
      now: () => new Date('2026-03-18T06:30:44.082Z'),
      acquireForecastBundle: async () => {
        calls.push('acquire');
        return forecast;
      },
      scoreForecast: async (bundle) => {
        calls.push(`score:${bundle.location.name}`);
        return scoredContext;
      },
      buildEditorialRequest: async (context) => {
        calls.push(`build:${context.today}`);
        return editorialRequest;
      },
      resolveEditorial: async (request) => {
        calls.push(`resolve:${request.prompt}`);
        return editorial;
      },
      renderBrief: async (context, decision) => {
        calls.push(`render:${context.todayBestScore}:${decision.selectedProvider}`);
        return outputs;
      },
      persistRun: async (run) => {
        calls.push('persist');
        persistedRuns.push(run);
      },
      deliverOutputs: async (run) => {
        calls.push('deliver');
        deliveredRuns.push(run);
      },
    });

    expect(calls).toEqual([
      'acquire',
      'score:Leeds',
      'build:Wednesday 18 March',
      'resolve:Respond with a short editorial summary.',
      'render:60:gemini',
      'persist',
      'deliver',
    ]);
    expect(result.generatedAt).toBe('2026-03-18T06:30:44.082Z');
    expect(result.forecast.location.name).toBe('Leeds');
    expect(result.editorial.selectedProvider).toBe('gemini');
    expect(result.outputs.emailHtml).toBe('<p>email</p>');
    expect(result.outputs.briefJson.schemaVersion).toBe(BRIEF_JSON_SCHEMA_VERSION);
    expect(result.stageTimingsMs.acquire).toBeTypeOf('number');
    expect(result.stageTimingsMs.deliver).toBeTypeOf('number');
    expect(persistedRuns).toHaveLength(1);
    expect(deliveredRuns).toHaveLength(1);
    expect(persistedRuns[0]).toBe(result);
    expect(deliveredRuns[0]).toBe(result);
  });
});
