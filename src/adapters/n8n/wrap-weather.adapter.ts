import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';

const EMPTY_WEATHER = { hourly: { time: [] }, daily: { sunrise: [], sunset: [], moonrise: [], moonset: [] } };

export function run({ $input }: N8nRuntime) {
  return [{ json: { weather: firstInputJson($input, EMPTY_WEATHER) } }];
}
