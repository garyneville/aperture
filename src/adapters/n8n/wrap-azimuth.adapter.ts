import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';

const EMPTY_AZIMUTH = { byPhase: { sunrise: {}, sunset: {} } };

export function run({ $input }: N8nRuntime) {
  const azimuth = firstInputJson($input, EMPTY_AZIMUTH);

  return [{ json: { azimuthByPhase: azimuth.byPhase || {} } }];
}
