import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ADAPTERS, SKELETON_PATH, assembleWorkflow, bundleAdapter, writeWorkflow } from './assemble.js';

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
    expect(result[0]?.json?.homeContext?.todayBestScore).toBe(61);
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
    expect(result[0]?.json?.homeContext?.todayBestScore).toBe(42);
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
    const weatherNode = data.nodes.find((item: { name: string }) => item.name === 'HTTP: Weather');
    const weatherConnections = data.connections['HTTP: Weather']?.main?.[0] ?? [];
    expect(weatherConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({ node: 'HTTP: Air Quality', index: 0 }),
      expect.objectContaining({ node: 'Code: Wrap Weather', index: 0 }),
    ]));
    // UKMO does not support these fields — they must NOT appear in the Weather URL
    expect(weatherNode?.parameters?.url).not.toContain('total_column_integrated_water_vapour');
    expect(weatherNode?.parameters?.url).not.toContain('boundary_layer_height');

    const ensembleConnection = data.connections['HTTP: Ensemble']?.main?.[0]?.[0];
    expect(ensembleConnection?.node).toBe('Code: Wrap Ensemble');

    const finalMergeConnection = data.connections['Merge: Score Input 6']?.main?.[0]?.[0];
    expect(finalMergeConnection?.node).toBe('Merge: Score Input 7');

    const satelliteMergeConnection = data.connections['Merge: Score Input 7']?.main?.[0]?.[0];
    expect(satelliteMergeConnection?.node).toBe('Merge: Score Input 8');

    const marineMergeConnection = data.connections['Merge: Score Input 8']?.main?.[0]?.[0];
    expect(marineMergeConnection?.node).toBe('Code: Build Score Input');

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
        nowcastSatellite: undefined,
        marine: { hourly: { time: [] } },
      },
    }]);
  });

  it('uses best-match model for precip prob and reserves ukmo_seamless for main weather', () => {
    const skeleton = JSON.parse(readFileSync(SKELETON_PATH, 'utf-8'));

    const precipNode = skeleton.nodes.find((n: { name: string }) => n.name === 'HTTP: Precip Prob');
    expect(precipNode).toBeTruthy();
    const precipUrl: string = precipNode.parameters.url;
    // Precip prob must NOT pin to ukmo_seamless — that model returns null for precipitation_probability
    expect(precipUrl).not.toContain('models=ukmo_seamless');
    expect(precipUrl).toContain('hourly=precipitation_probability');
    expect(precipUrl).toContain('forecast_days=5');

    const weatherNode = skeleton.nodes.find((n: { name: string }) => n.name === 'HTTP: Weather');
    expect(weatherNode).toBeTruthy();
    const weatherUrl: string = weatherNode.parameters.url;
    // Main weather call should use ukmo_seamless but NOT request fields UKMO can't serve:
    // - precipitation_probability (handled by dedicated Precip Prob node)
    // - total_column_integrated_water_vapour (UKMO returns null; scoring falls back to 20)
    // - boundary_layer_height (UKMO returns null; scoring falls back to null)
    expect(weatherUrl).toContain('models=ukmo_seamless');
    expect(weatherUrl).not.toContain('precipitation_probability');
    expect(weatherUrl).not.toContain('total_column_integrated_water_vapour');
    expect(weatherUrl).not.toContain('boundary_layer_height');
    expect(weatherUrl).toContain('precipitation');
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
            homeContext: {
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
            homeContext: {
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
            homeContext: {
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
            homeContext: {
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
    expect(groqConnection?.node).toBe('Code: Inspect Groq Primary');
    expect(groqConnection?.index).toBe(0);

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
        briefJson: expect.objectContaining({
          schemaVersion: 'aperture-brief/v1',
          aiText: 'Stay home today.',
        }),
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
    const webhookNode = data.nodes.find((item: { name: string }) => item.name === 'Webhook: Run Brief');
    expect(webhookNode).toBeTruthy();
    expect(webhookNode.parameters.path).toBe('__PHOTO_BRIEF_TRIGGER_PATH__');
    expect(webhookNode.parameters.httpMethod).toBe('POST');

    const webhookConnections = data.connections['Webhook: Run Brief']?.main?.[0] ?? [];
    expect(webhookConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({ node: 'Code: Debug Config', index: 0 }),
      expect.objectContaining({ node: 'HTTP: Weather', index: 0 }),
      expect.objectContaining({ node: 'HTTP: Kp Index', index: 0 }),
    ]));

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
        triggerSource: 'schedule',
        triggerRequest: null,
      },
    }]);

    const webhookDebugConfig = debugConfigFn(
      () => ({ first: () => ({ json: {} }), all: () => [] }),
      {
        first: () => ({
          json: {
            body: { triggerSource: 'github-actions-deploy', reason: 'post-deploy validation run' },
            query: {},
            params: {},
            headers: { 'content-type': 'application/json' },
          },
        }),
        all: () => [],
      },
    );
    expect(webhookDebugConfig).toEqual([{
      json: {
        debugMode: false,
        debugModeSource: 'debug recipient missing',
        debugEmailTo: '',
        triggerSource: 'github-actions-deploy',
        triggerRequest: {
          body: { triggerSource: 'github-actions-deploy', reason: 'post-deploy validation run' },
          query: {},
          params: {},
        },
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
        sessionRecommendation: {
          primary: null,
          runnerUps: [],
          bySession: [],
          hoursAnalyzed: 0,
          planB: null,
          alerts: [],
        },
        debugContext: expect.objectContaining({
          hourlyScoring: [],
          windows: [],
          nearbyAlternatives: [],
        }),
      },
    }]);
  });

  it('assembles Gemini fallback extraction that preserves payload diagnostics through wrapped response shapes', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const httpNode = data.nodes.find((item: { name: string }) => item.name === 'HTTP: Gemini Fallback');
    const extractNode = data.nodes.find((item: { name: string }) => item.name === 'Code: Extract Gemini Fallback');
    expect(httpNode).toBeTruthy();
    expect(extractNode).toBeTruthy();
    expect(httpNode.parameters.body).toContain('maxOutputTokens: 1600');
    expect(httpNode.parameters.options.response.response.fullResponse).toBe(true);
    expect(httpNode.parameters.options.response.response.responseFormat).toBe('json');

    const fn = new Function('$', '$input', extractNode.parameters.jsCode);
    const result = fn(
      () => ({
        first: () => ({ json: {} }),
        all: () => [],
      }),
      {
        first: () => ({
          json: {
            statusCode: 200,
            body: {
              data: {
                candidates: [{
                  finishReason: 'MAX_TOKENS',
                  content: {
                    parts: [
                      { text: '{"editorial":"The moon sets before ', thoughtSignature: 'sig-1' },
                      { text: 'the midnight astro window begins.","composition":["Face north"]}' },
                    ],
                  },
                }],
                usageMetadata: {
                  promptTokenCount: 124,
                  candidatesTokenCount: 178,
                  totalTokenCount: 1006,
                  thoughtsTokenCount: 704,
                },
              },
            },
          },
        }),
        all: () => [],
      },
    );

    expect(result).toEqual([{
      json: {
        geminiResponse: '{"editorial":"The moon sets before the midnight astro window begins.","composition":["Face north"]}',
        geminiStatusCode: 200,
        geminiFinishReason: 'MAX_TOKENS',
        geminiCandidateCount: 1,
        geminiResponseByteLength: expect.any(Number),
        geminiResponseTruncated: true,
        geminiRawPayload: expect.stringContaining('"thoughtsTokenCount":704'),
        geminiExtractionPath: 'item.body.data',
        geminiTopLevelKeys: ['statusCode', 'body'],
        geminiPayloadKeys: ['candidates', 'usageMetadata'],
        geminiPartKinds: ['text', 'thoughtSignature'],
        geminiExtractedTextLength: expect.any(Number),
        geminiPromptTokenCount: 124,
        geminiCandidatesTokenCount: 178,
        geminiTotalTokenCount: 1006,
        geminiThoughtsTokenCount: 704,
        geminiRetryAfter: null,
        geminiErrorDetail: 'reason=truncated',
      },
    }]);
  });

  it('assembles Gemini fallback extraction that decodes buffered full-response bodies', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const extractNode = data.nodes.find((item: { name: string }) => item.name === 'Code: Extract Gemini Fallback');
    expect(extractNode).toBeTruthy();

    const fn = new Function('$', '$input', extractNode.parameters.jsCode);
    const rawGeminiBody = JSON.stringify({
      candidates: [{
        finishReason: 'STOP',
        content: {
          parts: [
            { text: '{"editorial":"Golden light breaks cleanly through the last clear band.","composition":["Face west across the ridge"],"weekStandout":"Tonight is the cleanest shot this week."}', thoughtSignature: 'sig-2' },
          ],
        },
      }],
      usageMetadata: {
        promptTokenCount: 88,
        candidatesTokenCount: 42,
        totalTokenCount: 130,
        thoughtsTokenCount: 19,
      },
    });
    const splitIndex = Math.floor(rawGeminiBody.length / 2);
    const bufferedBody = {
      _readableState: {
        buffer: [
          { type: 'Buffer', data: Array.from(Buffer.from(rawGeminiBody.slice(0, splitIndex), 'utf8')) },
          { type: 'Buffer', data: Array.from(Buffer.from(rawGeminiBody.slice(splitIndex), 'utf8')) },
        ],
      },
    };

    const result = fn(
      () => ({
        first: () => ({ json: {} }),
        all: () => [],
      }),
      {
        first: () => ({
          json: {
            body: bufferedBody,
            headers: { 'content-type': 'application/json' },
            statusCode: 200,
            statusMessage: 'OK',
          },
        }),
        all: () => [],
      },
    );

    expect(result).toEqual([{
      json: {
        geminiResponse: '{"editorial":"Golden light breaks cleanly through the last clear band.","composition":["Face west across the ridge"],"weekStandout":"Tonight is the cleanest shot this week."}',
        geminiStatusCode: 200,
        geminiFinishReason: 'STOP',
        geminiCandidateCount: 1,
        geminiResponseByteLength: Buffer.byteLength(rawGeminiBody, 'utf8'),
        geminiResponseTruncated: false,
        geminiRawPayload: rawGeminiBody,
        geminiExtractionPath: 'item.body._readableState.buffer (decoded) (parsed)',
        geminiTopLevelKeys: ['body', 'headers', 'statusCode', 'statusMessage'],
        geminiPayloadKeys: ['candidates', 'usageMetadata'],
        geminiPartKinds: ['text', 'thoughtSignature'],
        geminiExtractedTextLength: expect.any(Number),
        geminiPromptTokenCount: 88,
        geminiCandidatesTokenCount: 42,
        geminiTotalTokenCount: 130,
        geminiThoughtsTokenCount: 19,
        geminiRetryAfter: null,
        geminiErrorDetail: null,
      },
    }]);
  });

  it('assembles conditional editorial fallback routing after Groq inspection', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const groqNode = data.nodes.find((item: { name: string }) => item.name === 'HTTP: Groq');
    const inspectNode = data.nodes.find((item: { name: string }) => item.name === 'Code: Inspect Groq Primary');
    const ifNode = data.nodes.find((item: { name: string }) => item.name === 'If: Need Gemini Fallback');
    const routeNode = data.nodes.find((item: { name: string }) => item.name === 'Merge: Editorial Route');

    expect(groqNode).toBeTruthy();
    expect(groqNode.parameters.options.response.response.fullResponse).toBe(true);
    expect(groqNode.parameters.options.response.response.responseFormat).toBe('json');
    expect(groqNode.parameters.body).toContain("$json.editorialPromptMode === 'structured-output'");
    expect(groqNode.parameters.body).toContain("response_format: { type: 'json_schema'");
    expect(groqNode.parameters.body).toContain("content: $json.systemPrompt");
    expect(groqNode.parameters.body).toContain("content: $json.userPrompt");
    expect(groqNode.parameters.body).toContain('schema: $json.responseSchema');
    expect(inspectNode).toBeTruthy();
    expect(ifNode).toBeTruthy();
    expect(routeNode).toBeTruthy();
    expect(routeNode.parameters.mode).toBe('append');

    const buildPromptConnections = data.connections['Code: Build Prompt']?.main?.[0] ?? [];
    expect(buildPromptConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({ node: 'HTTP: Groq', index: 0 }),
      expect.objectContaining({ node: 'Merge: Prompt + Groq', index: 0 }),
      expect.objectContaining({ node: 'If: Run Inspire', index: 0 }),
    ]));
    expect(buildPromptConnections).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ node: 'HTTP: Gemini Fallback' }),
    ]));

    const groqConnections = data.connections['HTTP: Groq']?.main?.[0] ?? [];
    expect(groqConnections).toEqual([
      expect.objectContaining({ node: 'Code: Inspect Groq Primary', index: 0 }),
    ]);

    const mergeConnections = data.connections['Merge: Prompt + Groq']?.main?.[0] ?? [];
    expect(mergeConnections).toEqual([
      expect.objectContaining({ node: 'If: Need Gemini Fallback', index: 0 }),
    ]);

    const ifConnections = data.connections['If: Need Gemini Fallback']?.main ?? [];
    expect(ifConnections[0]).toEqual([
      expect.objectContaining({ node: 'HTTP: Gemini Fallback', index: 0 }),
      expect.objectContaining({ node: 'Merge: Prompt + Gemini FB', index: 0 }),
    ]);
    expect(ifConnections[1]).toEqual([
      expect.objectContaining({ node: 'Merge: Editorial Route', index: 0 }),
    ]);

    const inspectFn = new Function('$', '$input', inspectNode.parameters.jsCode);
    const goodResult = inspectFn(
      () => ({
        first: () => ({ json: {} }),
        all: () => [],
      }),
      {
        first: () => ({
          json: {
            statusCode: 200,
            body: {
              choices: [{ message: { content: JSON.stringify({ editorial: 'Good window.', composition: [] }) } }],
            },
          },
        }),
        all: () => [],
      },
    );

    expect(goodResult).toEqual([{
      json: expect.objectContaining({
        groqFallbackRequired: false,
        groqFallbackReason: null,
        groqStatusCode: 200,
      }),
    }]);

    const malformedResult = inspectFn(
      () => ({
        first: () => ({ json: {} }),
        all: () => [],
      }),
      {
        first: () => ({
          json: {
            statusCode: 200,
            body: {
              choices: [{ message: { content: '{"editorial":' } }],
            },
          },
        }),
        all: () => [],
      },
    );

    expect(malformedResult).toEqual([{
      json: expect.objectContaining({
        groqFallbackRequired: true,
        groqFallbackReason: 'malformed-structured-output',
      }),
    }]);
  });
});
