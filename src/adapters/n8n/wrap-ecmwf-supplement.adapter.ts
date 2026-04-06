import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';

const EMPTY_ECMWF = { hourly: { time: [] } };

export function run({ $input }: N8nRuntime) {
  return [{ json: { ecmwfSupplement: firstInputJson($input, EMPTY_ECMWF) } }];
}
