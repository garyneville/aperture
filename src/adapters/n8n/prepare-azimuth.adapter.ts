import { prepareAzimuthSamples } from '../../core/prepare-azimuth.js';
import { getPhotoWeatherLat, getPhotoWeatherLon, PHOTO_WEATHER_CONFIG } from '../../config.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  let shData: Array<{ type?: string; direction?: string | number }> = [];
  try {
    const candidate = $input.first().json;
    shData = Array.isArray(candidate) ? candidate : [];
  } catch {
    shData = [];
  }

  const samples = prepareAzimuthSamples({
    lat: getPhotoWeatherLat(),
    lon: getPhotoWeatherLon(),
    timezone: PHOTO_WEATHER_CONFIG.timezone || 'Europe/London',
    sunsetHueData: shData,
  });

  return samples.map(s => ({ json: s }));
}
