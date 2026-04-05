import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';

export function run({ $input }: N8nRuntime) {
  const raw = firstInputJson($input, {} as any);
  const data = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
  return [{ json: { sunsetHue: data } }];
}
