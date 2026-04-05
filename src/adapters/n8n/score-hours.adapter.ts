import { scoreAllDays } from '../../domain/scoring/score-all-days.js';
import { getPhotoWeatherLat, getPhotoWeatherLon, getPhotoWeatherTimezone } from '../../config.js';
import type { N8nRuntime } from './types.js';

const EMPTY_WEATHER = { hourly: { time: [] }, daily: { sunrise: [], sunset: [], moonrise: [], moonset: [] } };
const EMPTY_HOURLY = { hourly: { time: [] } };

function hasHourlyTime(obj: unknown): obj is { hourly: { time: string[] } } {
  return obj != null
    && typeof obj === 'object'
    && 'hourly' in obj
    && (obj as Record<string, unknown>).hourly != null
    && typeof (obj as Record<string, unknown>).hourly === 'object'
    && Array.isArray(((obj as Record<string, unknown>).hourly as Record<string, unknown>).time);
}

export function run({ $input }: N8nRuntime) {
  const input = (() => {
    try {
      return $input.first().json ?? {};
    } catch {
      return {};
    }
  })();

  const weather = input.weather ?? EMPTY_WEATHER;
  if (!hasHourlyTime(weather)) {
    console.warn('[score-hours] input.weather missing hourly.time array — using empty fallback');
  }

  const result = scoreAllDays({
    lat: getPhotoWeatherLat(),
    lon: getPhotoWeatherLon(),
    timezone: getPhotoWeatherTimezone(),
    weather: hasHourlyTime(weather) ? weather : EMPTY_WEATHER,
    airQuality: input.airQuality ?? EMPTY_HOURLY,
    metarRaw: Array.isArray(input.metarRaw) ? input.metarRaw : [],
    sunsetHue: Array.isArray(input.sunsetHue) ? input.sunsetHue : [],
    ensemble: input.ensemble ?? EMPTY_HOURLY,
    azimuthByPhase: input.azimuthByPhase ?? {},
    precipProb: input.precipProb ?? EMPTY_HOURLY,
    nowcastSatellite: input.nowcastSatellite ?? undefined,
  }, new Date());

  return [{ json: result }];
}
