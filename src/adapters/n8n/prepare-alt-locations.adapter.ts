import { prepareAltLocations } from '../../lib/prepare-alt-locations.js';
import { getPhotoWeatherTimezone } from '../../config.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const homeContext = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();
  const locations = prepareAltLocations(getPhotoWeatherTimezone());
  return locations.map(loc => ({ json: { ...loc, homeContext } }));
}
