import { scoreAllDays } from '../../core/score-hours.js';
import { getPhotoWeatherLat, getPhotoWeatherLon, getPhotoWeatherTimezone } from '../../config.js';
import type { N8nRuntime } from './types.js';

const EMPTY_WEATHER = { hourly: { time: [] }, daily: { sunrise: [], sunset: [], moonrise: [], moonset: [] } };
const EMPTY_HOURLY = { hourly: { time: [] } };

export function run({ $input }: N8nRuntime) {
  const input = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();

  const result = scoreAllDays({
    lat: getPhotoWeatherLat(),
    lon: getPhotoWeatherLon(),
    timezone: getPhotoWeatherTimezone(),
    weather: input.weather ?? EMPTY_WEATHER,
    airQuality: input.airQuality ?? EMPTY_HOURLY,
    metarRaw: input.metarRaw ?? [],
    sunsetHue: input.sunsetHue ?? [],
    ensemble: input.ensemble ?? EMPTY_HOURLY,
    azimuthByPhase: input.azimuthByPhase ?? {},
    precipProb: input.precipProb ?? EMPTY_HOURLY,
  }, new Date());

  return [{ json: result }];
}
