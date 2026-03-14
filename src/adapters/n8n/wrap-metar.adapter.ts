import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';

export function run({ $input }: N8nRuntime) {
  return [{ json: { metarRaw: firstInputJson($input, []) } }];
}
