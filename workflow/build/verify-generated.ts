/**
 * Verification script: rebuilds generated artifacts in memory and compares
 * them against the committed files. Exits non-zero if any differ.
 *
 * Usage: node --loader ts-node/esm workflow/build/verify-generated.ts
 */
import { readFileSync } from 'fs';
import { assembleWorkflow, OUTPUT_PATH as WORKFLOW_OUTPUT_PATH } from './assemble.js';
import { buildGeneratedModule, OUTPUT_PATH as EMAIL_OUTPUT_PATH } from './compile-email.js';

async function main() {
  let failed = false;

  // Check email templates
  const expectedEmail = buildGeneratedModule();
  const actualEmail = readFileSync(EMAIL_OUTPUT_PATH, 'utf-8');
  if (expectedEmail !== actualEmail) {
    console.error(`MISMATCH: ${EMAIL_OUTPUT_PATH}`);
    failed = true;
  } else {
    console.log(`OK: ${EMAIL_OUTPUT_PATH}`);
  }

  // Check workflow
  const expectedWorkflow = await assembleWorkflow();
  const actualWorkflow = readFileSync(WORKFLOW_OUTPUT_PATH, 'utf-8');
  if (expectedWorkflow !== actualWorkflow) {
    console.error(`MISMATCH: ${WORKFLOW_OUTPUT_PATH}`);
    failed = true;
  } else {
    console.log(`OK: ${WORKFLOW_OUTPUT_PATH}`);
  }

  if (failed) {
    console.error('\nGenerated files are out of date. Run "npm run build" and commit the results.');
    process.exit(1);
  }

  console.log('\nAll generated files are up to date.');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
