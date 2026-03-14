import { scoreAllDays } from '../../core/score-hours.js';
import type { N8nRuntime } from './types.js';

export function run({ $ }: N8nRuntime) {
  const vars = $('Set Variables').first().json;
  const w = $('HTTP: Weather').first().json;
  const aq = $('HTTP: Air Quality').first().json;
  const metarRaw = $('HTTP: METAR').first().json;
  const shData = $('HTTP: SunsetHue').first().json;
  const ensData = $('HTTP: Ensemble').first().json;
  const azimuthData = $('Code: Aggregate Azimuth').first().json || {};
  const ppData = $('HTTP: Precip Prob').first().json;

  const result = scoreAllDays({
    lat: parseFloat(vars.lat || 53.82703),
    lon: parseFloat(vars.lon || -1.570755),
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
