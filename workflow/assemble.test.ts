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
        first: () => ({ json: {} }),
        all: () => [],
      },
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(8);
    expect(result[0]?.json?.name).toBe('Bolton Abbey');
    expect(result[0]?.json?.url).toContain('timezone=Europe%2FLondon');
    expect(result[0]?.json?.url).not.toContain('__PHOTO_WEATHER_TIMEZONE__');
  });

  it('assembles retry-safe score input packaging ahead of score-hours', async () => {
    const workflowJson = await assembleWorkflow();
    const tmpDir = mkdtempSync(join(tmpdir(), 'photo-brief-'));
    tempDirs.push(tmpDir);

    const outputPath = join(tmpDir, 'workflow.json');
    writeWorkflow(workflowJson, outputPath);

    const data = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const ensembleConnection = data.connections['HTTP: Ensemble']?.main?.[0]?.[0];
    expect(ensembleConnection?.node).toBe('Code: Build Score Input');

    const node = data.nodes.find((item: { name: string }) => item.name === 'Code: Build Score Input');
    expect(node).toBeTruthy();

    const fn = new Function('$', '$input', node.parameters.jsCode);
    const result = fn(
      (nodeName: string) => ({
        first: () => ({
          json: {
            'HTTP: Weather': { hourly: { time: ['2026-03-14T06:00'] }, daily: { sunrise: ['2026-03-14T06:15'], sunset: ['2026-03-14T18:12'] } },
            'HTTP: Air Quality': { hourly: { time: ['2026-03-14T06:00'] } },
            'HTTP: METAR': [{ rawOb: 'EGNM 140620Z CAVOK' }],
            'HTTP: SunsetHue': [{ time: '2026-03-14T18:12:00Z', type: 'sunset', quality: 0.7 }],
            'HTTP: Precip Prob': { hourly: { time: ['2026-03-14T06:00'], precipitation_probability: [10] } },
            'Code: Aggregate Azimuth': { byPhase: { sunrise: { '2026-03-14T06:15': { occlusionRisk: 12 } }, sunset: {} } },
          }[nodeName],
        }),
        all: () => [],
      }),
      {
        first: () => ({ json: { hourly: { time: ['2026-03-14T06:00'], cloudcover_member_0: [25] } } }),
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
      },
    }]);
  });
});
