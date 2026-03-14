/**
 * Assembly script: reads skeleton.json, bundles each adapter with esbuild,
 * and injects the bundled JS into the skeleton to produce the final workflow JSON.
 *
 * Usage: node --loader ts-node/esm workflow/assemble.ts
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SKELETON_PATH = resolve(ROOT, 'workflow', 'skeleton.json');
const OUTPUT_PATH = resolve(ROOT, '..', '..', 'ansible', 'files', 'n8n-workflows', 'photography-weather-brief.json');

const ADAPTERS: Record<string, string> = {
  'prepare-azimuth': 'src/adapters/n8n/prepare-azimuth.adapter.ts',
  'aggregate-azimuth': 'src/adapters/n8n/aggregate-azimuth.adapter.ts',
  'score-hours': 'src/adapters/n8n/score-hours.adapter.ts',
  'best-windows': 'src/adapters/n8n/best-windows.adapter.ts',
  'prepare-alt-locations': 'src/adapters/n8n/prepare-alt-locations.adapter.ts',
  'score-alternatives': 'src/adapters/n8n/score-alternatives.adapter.ts',
  'build-prompt': 'src/adapters/n8n/build-prompt.adapter.ts',
  'format-messages': 'src/adapters/n8n/format-messages.adapter.ts',
};

async function bundleAdapter(name: string, entryPoint: string): Promise<string> {
  const absPath = resolve(ROOT, entryPoint);
  let source = readFileSync(absPath, 'utf-8');

  // Convert ES import declarations to require() calls so esbuild treats the file
  // as a CommonJS script (not an ESM module), allowing top-level `return`.
  // Handles: import { a, b } from 'path'  and  import X from 'path'
  source = source.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]\s*;?/g,
    (_, names, path) => `const {${names}} = require('${path}');`,
  );
  source = source.replace(
    /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?/g,
    (_, name, path) => `const ${name} = require('${path}');`,
  );

  // Strip TypeScript `declare const` lines (n8n globals like $ and $input).
  // These can span multiple lines when they contain complex type annotations.
  source = source.replace(/^declare\s+const\s+.+$/gm, '');

  // Strip `import type` statements (type-only imports)
  source = source.replace(/import\s+type\s+[^;]+;/g, '');

  const result = await build({
    stdin: {
      contents: source,
      loader: 'ts',
      resolveDir: dirname(absPath),
      sourcefile: absPath,
    },
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    platform: 'node',
    treeShaking: true,
  });

  let code = result.outputFiles[0].text;

  // esbuild IIFE wraps everything in (() => { ... })();
  // Strip that wrapper so the code runs at top-level in n8n's sandbox.
  code = code.replace(/^\(\(\) => \{\n?/, '');
  code = code.replace(/\n?\}\)\(\);\s*$/, '');

  return code.trim();
}

async function main() {
  console.log('Reading skeleton...');
  const skeleton = readFileSync(SKELETON_PATH, 'utf-8');
  let output = skeleton;

  for (const [name, entry] of Object.entries(ADAPTERS)) {
    const placeholder = `__ADAPTER_${name}__`;
    console.log(`  Bundling ${name}...`);

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

  writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log(`\nAssembled workflow written to:\n  ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Assembly failed:', err);
  process.exit(1);
});
