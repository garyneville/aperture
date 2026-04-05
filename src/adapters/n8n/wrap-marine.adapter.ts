import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';

const EMPTY_MARINE = { hourly: { time: [] } };

export function run({ $input }: N8nRuntime) {
  return [{ json: { marine: firstInputJson($input, EMPTY_MARINE) } }];
}
