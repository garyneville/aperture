import { prepareAltLocations } from '../../core/prepare-alt-locations.js';
import { getPhotoWeatherTimezone } from '../../config.js';
import type { N8nRuntime } from './types.js';

export function run(_: N8nRuntime) {
  const locations = prepareAltLocations(getPhotoWeatherTimezone());
  return locations.map(loc => ({ json: loc }));
}
