import { prepareLongRangeLocations } from '../../core/prepare-long-range.js';
import { getPhotoWeatherTimezone } from '../../config.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const leedsContext = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();
  const locations = prepareLongRangeLocations(getPhotoWeatherTimezone());
  return locations.map(loc => ({ json: { ...loc, leedsContext } }));
}
