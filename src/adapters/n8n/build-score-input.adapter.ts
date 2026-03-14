import type { N8nRuntime } from './types.js';

const EMPTY_WEATHER = { hourly: { time: [] }, daily: { sunrise: [], sunset: [] } };
const EMPTY_HOURLY = { hourly: { time: [] } };
const EMPTY_AZIMUTH = { byPhase: { sunrise: {}, sunset: {} } };

function safeNodeJson(runtime: N8nRuntime['$'], nodeName: string, fallback: any) {
  try {
    return runtime(nodeName).first().json ?? fallback;
  } catch {
    return fallback;
  }
}

export function run({ $, $input }: N8nRuntime) {
  const ensemble = (() => {
    try {
      return $input.first().json ?? EMPTY_HOURLY;
    } catch {
      return safeNodeJson($, 'HTTP: Ensemble', EMPTY_HOURLY);
    }
  })();
  const azimuth = safeNodeJson($, 'Code: Aggregate Azimuth', EMPTY_AZIMUTH) || EMPTY_AZIMUTH;

  return [{
    json: {
      weather: safeNodeJson($, 'HTTP: Weather', EMPTY_WEATHER),
      airQuality: safeNodeJson($, 'HTTP: Air Quality', EMPTY_HOURLY),
      metarRaw: safeNodeJson($, 'HTTP: METAR', []),
      sunsetHue: safeNodeJson($, 'HTTP: SunsetHue', []),
      precipProb: safeNodeJson($, 'HTTP: Precip Prob', EMPTY_HOURLY),
      ensemble,
      azimuthByPhase: azimuth.byPhase || {},
    },
  }];
}
