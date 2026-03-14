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
});
