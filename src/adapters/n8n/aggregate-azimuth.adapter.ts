import { aggregateAzimuth } from '../../core/aggregate-azimuth.js';
import type { N8nRuntime } from './types.js';

export function run({ $, $input }: N8nRuntime) {
  const scanResults = $input.all().map(item => item.json);
  const sampleMeta = $('Code: Prepare Azimuth Samples').all().map(item => item.json);

  const result = aggregateAzimuth(scanResults, sampleMeta);
  return [{ json: result }];
}
