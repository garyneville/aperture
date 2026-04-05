import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';

const EMPTY_WEATHER = { hourly: { time: [] }, daily: { sunrise: [], sunset: [], moonrise: [], moonset: [] } };
const EMPTY_HOURLY = { hourly: { time: [] } };

export function run({ $input }: N8nRuntime) {
  const input = firstInputJson($input, {} as Record<string, any>);

  return [{
    json: {
      weather: input.weather ?? EMPTY_WEATHER,
      airQuality: input.airQuality ?? EMPTY_HOURLY,
      metarRaw: input.metarRaw ?? [],
      sunsetHue: input.sunsetHue ?? [],
      precipProb: input.precipProb ?? EMPTY_HOURLY,
      ensemble: input.ensemble ?? EMPTY_HOURLY,
      azimuthByPhase: input.azimuthByPhase ?? {},
      nowcastSatellite: input.nowcastSatellite ?? undefined,
    },
  }];
}
