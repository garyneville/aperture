/**
 * Assembly script: reads skeleton.json, bundles each adapter with esbuild,
 * and injects the bundled JS into the skeleton to produce the final workflow JSON.
 *
 * Usage: node --loader ts-node/esm workflow/assemble.ts
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..');
export const SKELETON_PATH = resolve(ROOT, 'workflow', 'skeleton.json');
export const OUTPUT_PATH = resolve(ROOT, '..', '..', 'ansible', 'files', 'n8n-workflows', 'photography-weather-brief.json');

export const ADAPTERS: Record<string, string> = {
  'prepare-azimuth': 'src/adapters/n8n/prepare-azimuth.adapter.ts',
  'aggregate-azimuth': 'src/adapters/n8n/aggregate-azimuth.adapter.ts',
  'build-score-input': 'src/adapters/n8n/build-score-input.adapter.ts',
  'score-hours': 'src/adapters/n8n/score-hours.adapter.ts',
  'best-windows': 'src/adapters/n8n/best-windows.adapter.ts',
  'prepare-alt-locations': 'src/adapters/n8n/prepare-alt-locations.adapter.ts',
  'score-alternatives': 'src/adapters/n8n/score-alternatives.adapter.ts',
  'build-prompt': 'src/adapters/n8n/build-prompt.adapter.ts',
  'format-messages': 'src/adapters/n8n/format-messages.adapter.ts',
};

export async function bundleAdapter(name: string, entryPoint: string): Promise<string> {
  const absPath = resolve(ROOT, entryPoint);
  const resultKey = `__photoBriefResult_${name.replace(/[^a-z0-9]+/gi, '_')}`;

  const result = await build({
    stdin: {
      contents: [
        `import { run as adapterRun } from './${basename(absPath)}';`,
        `globalThis.${resultKey} = adapterRun({ $, $input });`,
      ].join('\n'),
      loader: 'ts',
      resolveDir: dirname(absPath),
      sourcefile: `${name}.entry.ts`,
    },
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    platform: 'browser',
    treeShaking: true,
  });

  const code = result.outputFiles[0].text.trim();

  return [
    'return (() => {',
    `  delete globalThis.${resultKey};`,
    code,
    `  const __photoBriefResult = globalThis.${resultKey};`,
    `  delete globalThis.${resultKey};`,
    '  return __photoBriefResult;',
    '})();',
  ].join('\n');
}

export async function assembleWorkflow(): Promise<string> {
  const skeleton = readFileSync(SKELETON_PATH, 'utf-8');
  let output = skeleton;

  for (const [name, entry] of Object.entries(ADAPTERS)) {
    const placeholder = `__ADAPTER_${name}__`;
    const bundled = await bundleAdapter(name, entry);

    // The placeholder is inside a JSON string value, so we need to JSON-escape
    // the bundled code (newlines -> \n, quotes -> \", etc.)
    // We do this by using JSON.stringify to escape, then stripping the outer quotes.
    const escaped = JSON.stringify(bundled).slice(1, -1);

    if (!output.includes(placeholder)) {
      throw new Error(`Placeholder ${placeholder} not found in skeleton!`);
    }

    output = output.replace(placeholder, escaped);
  }

  // Validate the output is valid JSON
  try {
    JSON.parse(output);
  } catch (e) {
    throw new Error(`Assembled output is not valid JSON: ${e}`);
  }

  return output;
}

export function writeWorkflow(output: string, outputPath = OUTPUT_PATH) {
  writeFileSync(outputPath, output, 'utf-8');
}

async function main() {
  console.log('Reading skeleton...');
  const output = await assembleWorkflow();
  writeWorkflow(output);
  console.log(`\nAssembled workflow written to:\n  ${OUTPUT_PATH}`);
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch(err => {
    console.error('Assembly failed:', err);
    process.exit(1);
  });
}
