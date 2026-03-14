import { prepareAltLocations } from '../../core/prepare-alt-locations.js';
import type { N8nRuntime } from './types.js';

export function run({ $ }: N8nRuntime) {
  const vars = $('Set Variables').first().json;
  const locations = prepareAltLocations(vars.timezone || 'Europe/London');
  return locations.map(loc => ({ json: loc }));
}
