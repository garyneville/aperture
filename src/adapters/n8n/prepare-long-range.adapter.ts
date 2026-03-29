import { prepareLongRangeLocations } from '../../core/prepare-long-range.js';
import { getPhotoWeatherLat, getPhotoWeatherLon, getPhotoWeatherTimezone } from '../../config.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const homeContext = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();
  const locations = prepareLongRangeLocations(getPhotoWeatherTimezone(), {
    lat: getPhotoWeatherLat(),
    lon: getPhotoWeatherLon(),
  });
  return locations.map(loc => ({ json: { ...loc, homeContext } }));
}
