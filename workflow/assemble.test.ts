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
    expect(code).toContain('return __photoBriefAdapter.run({ $, $input });');
  });

  it('assembles runnable code node output for prepare alt locations', async () => {
    const workflowJson = await assembleWorkflow();
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
});
