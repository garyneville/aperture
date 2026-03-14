import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';

const EMPTY_HOURLY = { hourly: { time: [] } };

export function run({ $input }: N8nRuntime) {
  return [{ json: { precipProb: firstInputJson($input, EMPTY_HOURLY) } }];
}
