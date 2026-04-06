import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';
import { getPhotoWeatherIsCoastal } from '../../config/runtime.js';

const EMPTY_MARINE = { hourly: { time: [] } };

export function run({ $input }: N8nRuntime) {
  // Inland locations never have useful marine data — skip processing
  if (!getPhotoWeatherIsCoastal()) {
    return [{ json: { marine: EMPTY_MARINE } }];
  }
  return [{ json: { marine: firstInputJson($input, EMPTY_MARINE) } }];
}
