import { scoreAllDays } from '../../core/score-hours.js';
import { getPhotoWeatherLat, getPhotoWeatherLon } from '../../config.js';
import type { N8nRuntime } from './types.js';

export function run({ $ }: N8nRuntime) {
  const w = $('HTTP: Weather').first().json;
  const aq = $('HTTP: Air Quality').first().json;
  const metarRaw = $('HTTP: METAR').first().json;
  const shData = $('HTTP: SunsetHue').first().json;
  const ensData = $('HTTP: Ensemble').first().json;
  const azimuthData = $('Code: Aggregate Azimuth').first().json || {};
  const ppData = $('HTTP: Precip Prob').first().json;

  const result = scoreAllDays({
    lat: getPhotoWeatherLat(),
    lon: getPhotoWeatherLon(),
    weather: w,
    airQuality: aq,
    metarRaw,
    sunsetHue: shData,
    ensemble: ensData,
    azimuthByPhase: azimuthData.byPhase || {},
    precipProb: ppData,
  }, new Date());

  return [{ json: result }];
}
