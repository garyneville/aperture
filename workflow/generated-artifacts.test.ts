import { readFileSync } from 'fs';
import { describe, it } from 'vitest';
import { OUTPUT_PATH as WORKFLOW_OUTPUT_PATH, assembleWorkflow } from './assemble.js';
import { OUTPUT_PATH as EMAIL_LAYOUT_OUTPUT_PATH, buildGeneratedModule } from './compile-email.js';

function normalizeEol(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function expectArtifactToBeCurrent(path: string, actual: string, expected: string) {
  if (normalizeEol(actual) !== normalizeEol(expected)) {
    throw new Error(`${path} is stale. Run \`npm run build\` and commit the regenerated artifacts.`);
  }
}

describe('generated artifacts', () => {
  it('keeps the compiled email layout up to date', () => {
    const committed = readFileSync(EMAIL_LAYOUT_OUTPUT_PATH, 'utf-8');
    const generated = buildGeneratedModule();

    expectArtifactToBeCurrent('src/core/email-layout.generated.ts', committed, generated);
  });

  it('keeps the committed workflow JSON up to date', async () => {
    const committed = readFileSync(WORKFLOW_OUTPUT_PATH, 'utf-8');
    const generated = await assembleWorkflow();

    expectArtifactToBeCurrent('workflow/photography-weather-brief.json', committed, generated);
  });
});
