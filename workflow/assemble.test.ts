import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADAPTERS, assembleWorkflow, bundleAdapter, writeWorkflow } from './assemble.js';

describe('workflow assembly', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('wraps bundled adapters with an explicit top-level return', async () => {
    const code = await bundleAdapter('prepare-alt-locations', ADAPTERS['prepare-alt-locations']);
    expect(code).toContain('return (() => {');
    expect(code).toContain('globalThis.__photoBriefResult_prepare_alt_locations = run({ $, $input });');
    expect(code).toContain('return __photoBriefResult;');
    expect(code).not.toContain('__photoBriefAdapter.run({ $, $input })');
  });

  it('assembles runnable code node output for prepare alt locations', async () => {
    const workflowJson = await assembleWorkflow();
    expect(workflowJson).not.toContain('__photoBriefAdapter.run(');
    expect(workflowJson).not.toContain("$('Set Variables')");
    expect(workflowJson).not.toContain('"name": "Set Variables"');

    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Prepare Alt Locations');
    expect(node).toBeTruthy();

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => ({ json: { timezone: 'Europe/London' } }),
        all: () => [],
      }),
      {
        first: () => ({ json: { todayBestScore: 61 } }),
        all: () => [],
      },
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(8);
    expect(result[0]?.json?.name).toBe('Bolton Abbey');
    expect(result[0]?.json?.leedsContext?.todayBestScore).toBe(61);
    expect(result[0]?.json?.url).toContain('timezone=Europe%2FLondon');
    expect(result[0]?.json?.url).not.toContain('__PHOTO_WEATHER_TIMEZONE__');
  });

  it('assembles runnable code node output for prepare long range', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Prepare Long Range');
    expect(node).toBeTruthy();

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => ({ json: { timezone: 'Europe/London' } }),
        all: () => [],
      }),
      {
        first: () => ({ json: { todayBestScore: 42, dailySummary: [{ headlineScore: 42 }] } }),
        all: () => [],
      },
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(10);
    expect(result[0]?.json?.name).toBe('Pen-y-ghent');
    expect(result[0]?.json?.leedsContext?.todayBestScore).toBe(42);
    expect(result[0]?.json?.url).toContain('forecast_days=1');
    expect(result[0]?.json?.url).not.toContain('__PHOTO_WEATHER_TIMEZONE__');
  });

  it('assembles retry-safe score input packaging ahead of score-hours', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const weatherConnections = data.connections['HTTP: Weather']?.main?.[0] ?? [];
    expect(weatherConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({ node: 'HTTP: Air Quality', index: 0 }),
      expect.objectContaining({ node: 'Code: Wrap Weather', index: 0 }),
    ]));

    const ensembleConnection = data.connections['HTTP: Ensemble']?.main?.[0]?.[0];
    expect(ensembleConnection?.node).toBe('Code: Wrap Ensemble');

    const finalMergeConnection = data.connections['Merge: Score Input 6']?.main?.[0]?.[0];
    expect(finalMergeConnection?.node).toBe('Code: Build Score Input');

    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Build Score Input');
    expect(node).toBeTruthy();
    expect(node.parameters.jsCode).not.toContain('HTTP: Weather');
    expect(node.parameters.jsCode).not.toContain('HTTP: Air Quality');
    expect(node.parameters.jsCode).not.toContain('HTTP: METAR');
    expect(node.parameters.jsCode).not.toContain('HTTP: SunsetHue');
    expect(node.parameters.jsCode).not.toContain('HTTP: Precip Prob');
    expect(node.parameters.jsCode).not.toContain('Code: Aggregate Azimuth');
    expect(node.parameters.jsCode).not.toContain('HTTP: Ensemble');

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => {
          throw new Error('unexpected selector lookup');
        },
        all: () => [],
      }),
      {
        first: () => ({
          json: {
            weather: { hourly: { time: ['2026-03-14T06:00'] }, daily: { sunrise: ['2026-03-14T06:15'], sunset: ['2026-03-14T18:12'] } },
            airQuality: { hourly: { time: ['2026-03-14T06:00'] } },
            metarRaw: [{ rawOb: 'EGNM 140620Z CAVOK' }],
            sunsetHue: [{ time: '2026-03-14T18:12:00Z', type: 'sunset', quality: 0.7 }],
            precipProb: { hourly: { time: ['2026-03-14T06:00'], precipitation_probability: [10] } },
            ensemble: { hourly: { time: ['2026-03-14T06:00'], cloudcover_member_0: [25] } },
            azimuthByPhase: { sunrise: { '2026-03-14T06:15': { occlusionRisk: 12 } }, sunset: {} },
          },
        }),
        all: () => [],
      },
    );

    expect(result).toEqual([{
      json: {
        weather: { hourly: { time: ['2026-03-14T06:00'] }, daily: { sunrise: ['2026-03-14T06:15'], sunset: ['2026-03-14T18:12'] } },
        airQuality: { hourly: { time: ['2026-03-14T06:00'] } },
        metarRaw: [{ rawOb: 'EGNM 140620Z CAVOK' }],
        sunsetHue: [{ time: '2026-03-14T18:12:00Z', type: 'sunset', quality: 0.7 }],
        precipProb: { hourly: { time: ['2026-03-14T06:00'], precipitation_probability: [10] } },
        ensemble: { hourly: { time: ['2026-03-14T06:00'], cloudcover_member_0: [25] } },
        azimuthByPhase: { sunrise: { '2026-03-14T06:15': { occlusionRisk: 12 } }, sunset: {} },
      },
    }]);
  });

  it('assembles score-alternatives code that consumes only merged workflow input', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const altWeatherConnection = data.connections['HTTP: Alt Weather']?.main?.[0]?.[0];
    expect(altWeatherConnection?.node).toBe('Merge: Alt Weather Context');
    expect(altWeatherConnection?.index).toBe(1);

    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Score Alternatives');
    expect(node).toBeTruthy();
    expect(node.parameters.jsCode).not.toContain('Code: Prepare Alt Locations');
    expect(node.parameters.jsCode).not.toContain('Code: Best Windows');

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => {
          throw new Error('unexpected selector lookup');
        },
        all: () => [],
      }),
      {
        first: () => ({
          json: {
            name: 'Bolton Abbey',
            lat: 53.984,
            lon: -1.878,
            driveMins: 35,
            types: ['mist', 'atmospheric'],
            darkSky: false,
            leedsContext: {
              windows: [],
              dontBother: true,
              todayBestScore: 0,
              todayCarWash: { score: 0 },
              dailySummary: [],
              metarNote: '',
              sunrise: null,
              sunset: null,
              moonPct: 0,
            },
            hourly: { time: [] },
            daily: { sunrise: [], sunset: [] },
          },
        }),
        all: () => [{
          json: {
            name: 'Bolton Abbey',
            lat: 53.984,
            lon: -1.878,
            driveMins: 35,
            types: ['mist', 'atmospheric'],
            darkSky: false,
            leedsContext: {
              windows: [],
              dontBother: true,
              todayBestScore: 0,
              todayCarWash: { score: 0 },
              dailySummary: [],
              metarNote: '',
              sunrise: null,
              sunset: null,
              moonPct: 0,
            },
            hourly: { time: [] },
            daily: { sunrise: [], sunset: [] },
          },
        }],
      },
    );

    expect(result).toEqual([{
      json: {
        altLocations: [],
        closeContenders: [],
        noAltsMsg: 'No nearby locations score well enough today to recommend a trip.',
        windows: [],
        dontBother: true,
        todayBestScore: 0,
        todayCarWash: { score: 0 },
        dailySummary: [],
        metarNote: '',
        sunrise: null,
        sunset: null,
        moonPct: 0,
        debugContext: expect.objectContaining({
          nearbyAlternatives: [],
        }),
      },
    }]);
  });

  it('assembles long-range scoring code that consumes only merged workflow input', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const bestWindowsConnections = data.connections['Code: Best Windows']?.main?.[0] ?? [];
    expect(bestWindowsConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({ node: 'Code: Prepare Alt Locations', index: 0 }),
      expect.objectContaining({ node: 'Code: Prepare Long Range', index: 0 }),
    ]));

    const longRangeWeatherConnection = data.connections['HTTP: Long Range Weather']?.main?.[0]?.[0];
    expect(longRangeWeatherConnection?.node).toBe('Merge: Long Range Weather Context');
    expect(longRangeWeatherConnection?.index).toBe(1);

    const altScoreConnection = data.connections['Code: Score Alternatives']?.main?.[0]?.[0];
    expect(altScoreConnection?.node).toBe('Merge: Scoring + Long Range');
    expect(altScoreConnection?.index).toBe(0);

    const longRangeScoreConnection = data.connections['Code: Score Long Range']?.main?.[0]?.[0];
    expect(longRangeScoreConnection?.node).toBe('Merge: Scoring + Long Range');
    expect(longRangeScoreConnection?.index).toBe(1);

    const longRangeMergeConnection = data.connections['Merge: Scoring + Long Range']?.main?.[0]?.[0];
    expect(longRangeMergeConnection?.node).toBe('Merge: Scoring + Kp');
    expect(longRangeMergeConnection?.index).toBe(0);

    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Score Long Range');
    expect(node).toBeTruthy();
    expect(node.parameters.jsCode).not.toContain('Code: Prepare Long Range');
    expect(node.parameters.jsCode).not.toContain('Code: Best Windows');

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => {
          throw new Error('unexpected selector lookup');
        },
        all: () => [],
      }),
      {
        first: () => ({
          json: {
            name: 'Kielder Forest',
            lat: 55.233,
            lon: -2.588,
            region: 'northumberland',
            elevation: 380,
            tags: ['woodland', 'lake'],
            siteDarkness: { bortle: 2, siteDarknessScore: 88, source: 'test', lookupDate: '2026-03-16' },
            darkSky: true,
            driveMins: 120,
            leedsContext: {
              dailySummary: [{ headlineScore: 42 }],
            },
            hourly: {
              time: ['2026-03-16T22:00:00.000Z'],
              cloudcover: [0],
              cloudcover_low: [0],
              cloudcover_mid: [0],
              cloudcover_high: [0],
              visibility: [30000],
              temperature_2m: [4],
              relativehumidity_2m: [55],
              dewpoint_2m: [0],
              precipitation_probability: [0],
              precipitation: [0],
              windspeed_10m: [5],
              windgusts_10m: [10],
              total_column_integrated_water_vapour: [8],
            },
            daily: {
              sunrise: ['2026-03-16T06:18:00.000Z'],
              sunset: ['2026-03-16T18:11:00.000Z'],
            },
          },
        }),
        all: () => [{
          json: {
            name: 'Kielder Forest',
            lat: 55.233,
            lon: -2.588,
            region: 'northumberland',
            elevation: 380,
            tags: ['woodland', 'lake'],
            siteDarkness: { bortle: 2, siteDarknessScore: 88, source: 'test', lookupDate: '2026-03-16' },
            darkSky: true,
            driveMins: 120,
            leedsContext: {
              dailySummary: [{ headlineScore: 42 }],
            },
            hourly: {
              time: ['2026-03-16T22:00:00.000Z'],
              cloudcover: [0],
              cloudcover_low: [0],
              cloudcover_mid: [0],
              cloudcover_high: [0],
              visibility: [30000],
              temperature_2m: [4],
              relativehumidity_2m: [55],
              dewpoint_2m: [0],
              precipitation_probability: [0],
              precipitation: [0],
              windspeed_10m: [5],
              windgusts_10m: [10],
              total_column_integrated_water_vapour: [8],
            },
            daily: {
              sunrise: ['2026-03-16T06:18:00.000Z'],
              sunset: ['2026-03-16T18:11:00.000Z'],
            },
          },
        }],
      },
    );

    expect(result[0]?.json?.longRangeTop?.name).toBe('Kielder Forest');
    expect(result[0]?.json).toHaveProperty('longRangeCardLabel');
    expect(result[0]?.json?.cardLabel).toBeUndefined();
    expect(result[0]?.json?.longRangeCandidates?.[0]?.name).toBe('Kielder Forest');
    expect(result[0]?.json?.longRangeDebugCandidates?.[0]?.name).toBe('Kielder Forest');
    expect(result[0]?.json?.longRangeDebugCandidates?.[0]?.shown).toBe(true);
  });

  it('assembles format-messages code that consumes only merged prompt input', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const groqConnection = data.connections['HTTP: Groq']?.main?.[0]?.[0];
    expect(groqConnection?.node).toBe('Merge: Prompt + Groq');
    expect(groqConnection?.index).toBe(1);

    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Format Messages');
    expect(node).toBeTruthy();
    expect(node.parameters.jsCode).not.toContain('Code: Build Prompt');

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => {
          throw new Error('unexpected selector lookup');
        },
        all: () => [],
      }),
      {
        first: () => ({
          json: {
            dontBother: true,
            windows: [],
            todayCarWash: {
              score: 0,
              rating: 'X',
              label: 'No good window',
              start: '--',
              end: '--',
              wind: 0,
              pp: 0,
              tmp: 0,
            },
            dailySummary: [],
            altLocations: [],
            noAltsMsg: 'No nearby locations score well enough today to recommend a trip.',
            sunriseStr: '--:--',
            sunsetStr: '--:--',
            moonPct: 0,
            metarNote: '',
            today: 'Saturday 14 March',
            todayBestScore: 0,
            shSunsetQ: null,
            shSunriseQ: null,
            shSunsetText: null,
            sunDir: null,
            crepPeak: 0,
            choices: [{ message: { content: 'Stay home today.' } }],
          },
        }),
        all: () => [],
      },
    );

    expect(result).toEqual([{
      json: {
        telegramMsg: expect.stringContaining('Stay home today.'),
        emailHtml: expect.any(String),
        siteHtml: expect.any(String),
        debugMode: false,
        debugEmailTo: '',
        debugEmailHtml: '',
        debugEmailSubject: expect.stringContaining('Photo Brief Debug'),
      },
    }]);
    expect(result[0]?.json?.emailHtml).toContain('No local window cleared the threshold today');
    expect(result[0]?.json?.emailHtml).not.toContain('If you still go: no clear local fallback window.');
    expect(result[0]?.json?.emailHtml).not.toContain('Today&#39;s window');
  });

  it('assembles the debug-email gate so no SendGrid call is made when debug mode is off', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const debugConfigConnection = data.connections['Code: Debug Config']?.main?.[0]?.[0];
    expect(debugConfigConnection?.node).toBe('Merge: Prompt + Debug Config');

    const debugConfigNode = data.nodes.find((item: { name: string }) => item.name === 'Code: Debug Config');
    expect(debugConfigNode).toBeTruthy();

    const debugConfigFn = new Function('$', '$input', debugConfigNode.parameters.jsCode);
    const debugConfig = debugConfigFn(
      () => ({ first: () => ({ json: {} }), all: () => [] }),
      { first: () => ({ json: {} }), all: () => [] },
    );
    expect(debugConfig).toEqual([{
      json: {
        debugMode: false,
        debugModeSource: 'debug recipient missing',
        debugEmailTo: '',
      },
    }]);

    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Prepare Debug Email');
    expect(node).toBeTruthy();

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const disabled = fn(
      () => ({ first: () => ({ json: {} }), all: () => [] }),
      { first: () => ({ json: { debugMode: false, debugEmailTo: 'debug@example.com', debugEmailHtml: '<p>x</p>' } }), all: () => [] },
    );
    expect(disabled).toEqual([]);

    const enabled = fn(
      () => ({ first: () => ({ json: {} }), all: () => [] }),
      { first: () => ({ json: { debugMode: true, debugEmailTo: 'debug@example.com', debugEmailHtml: '<p>x</p>', debugEmailSubject: 'Debug subject' } }), all: () => [] },
    );
    expect(enabled).toEqual([{
      json: {
        debugEmailTo: 'debug@example.com',
        debugEmailHtml: '<p>x</p>',
        debugEmailSubject: 'Debug subject',
      },
    }]);
  });

  it('assembles retry-safe prepare azimuth code without cross-node SunsetHue lookup', async () => {
    const workflowJson = await assembleWorkflow();
    expect(workflowJson).not.toContain("$('HTTP: SunsetHue')");

    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Prepare Azimuth Samples');
    expect(node).toBeTruthy();

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => {
          throw new Error('unexpected selector lookup');
        },
        all: () => [],
      }),
      {
        first: () => ({
          json: [
            { type: 'sunrise', direction: '92' },
            { type: 'sunset', direction: '268' },
          ],
        }),
        all: () => [],
      },
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(12);
    expect(result[0]?.json?.type).toBe('sunrise');
  });

  it('falls back to default azimuth bearings when SunsetHue input is unavailable', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Prepare Azimuth Samples');
    expect(node).toBeTruthy();

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => {
          throw new Error('unexpected selector lookup');
        },
        all: () => [],
      }),
      {
        first: () => {
          throw new Error('missing retry input');
        },
        all: () => [],
      },
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(12);
    expect(result[0]?.json?.bearing).toBe(90);
    expect(result[6]?.json?.bearing).toBe(270);
    expect(result[0]?.json?.url).toContain('timezone=Europe%2FLondon');
    expect(result[0]?.json?.url).not.toContain('__PHOTO_WEATHER_TIMEZONE__');
  });

  it('assembles aggregate azimuth code without prepare-azimuth selector lookups', async () => {
    const workflowJson = await assembleWorkflow();
    expect(workflowJson).not.toContain("$('Code: Prepare Azimuth Samples')");
  });

  it('falls back to an empty azimuth map when retry input is unavailable', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Aggregate Azimuth');
    expect(node).toBeTruthy();

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => {
          throw new Error('unexpected selector lookup');
        },
        all: () => [],
      }),
      {
        first: () => {
          throw new Error('missing retry input');
        },
        all: () => {
          throw new Error('missing retry input');
        },
      },
    );

    expect(result).toEqual([{ json: { byPhase: { sunrise: {}, sunset: {} } } }]);
  });

  it('assembles score-hours code that degrades to an empty scoring result when upstream data is unavailable', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Score Hours');
    expect(node).toBeTruthy();
    expect(node.parameters.jsCode).not.toContain('HTTP: Weather');
    expect(node.parameters.jsCode).not.toContain('Code: Aggregate Azimuth');

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => {
          throw new Error('unexpected selector lookup');
        },
        all: () => [],
      }),
      {
        first: () => {
          throw new Error('missing retry input');
        },
        all: () => [],
      },
    );

    expect(result).toEqual([{
      json: {
        todayHours: [],
        dailySummary: [],
        metarNote: '',
        debugContext: expect.objectContaining({
          hourlyScoring: [],
          windows: [],
          nearbyAlternatives: [],
        }),
      },
    }]);
  });
});
