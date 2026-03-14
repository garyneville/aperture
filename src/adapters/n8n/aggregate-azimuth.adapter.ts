import { aggregateAzimuth } from '../../core/aggregate-azimuth.js';
import type { N8nRuntime } from './types.js';

export function run({ $, $input }: N8nRuntime) {
  let scanResults: Array<Record<string, unknown>> = [];
  try {
    scanResults = $input.all().map(item => item.json);
  } catch {
    scanResults = [];
  }

  const distancesKm = [25, 50, 80, 120, 160, 200];
  const sampleMeta = scanResults.map((_, index) => ({
    type: index < distancesKm.length ? 'sunrise' : 'sunset',
    bearing: index < distancesKm.length ? 90 : 270,
    distanceKm: distancesKm[index % distancesKm.length],
  }));

  const result = aggregateAzimuth(scanResults, sampleMeta);
  return [{ json: result }];
}
