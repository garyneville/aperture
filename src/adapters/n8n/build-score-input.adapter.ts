import type { N8nRuntime } from './types.js';
import { firstInputJson } from './input.js';

const EMPTY_WEATHER = { hourly: { time: [] }, daily: { sunrise: [], sunset: [], moonrise: [], moonset: [] } };
const EMPTY_HOURLY = { hourly: { time: [] } };

/**
 * Merge ECMWF supplement fields (boundary_layer_height, soil_temperature_0cm)
 * into the primary weather object, aligning by timestamp.
 */
function mergeEcmwfSupplement(
  weather: Record<string, any>,
  ecmwf: Record<string, any>,
): Record<string, any> {
  const ecmwfTimes: string[] = ecmwf?.hourly?.time ?? [];
  if (!ecmwfTimes.length) return weather;

  const weatherTimes: string[] = weather?.hourly?.time ?? [];
  if (!weatherTimes.length) return weather;

  // Build a timestamp → index lookup for the ECMWF data
  const ecmwfIdx: Record<string, number> = {};
  ecmwfTimes.forEach((t, i) => { ecmwfIdx[t] = i; });

  const fields = ['boundary_layer_height', 'soil_temperature_0cm'] as const;

  for (const field of fields) {
    const ecmwfValues: (number | null)[] | undefined = ecmwf?.hourly?.[field];
    if (!ecmwfValues) continue;

    // Build an aligned array matching the weather time axis
    const aligned: (number | null)[] = weatherTimes.map(t => {
      const idx = ecmwfIdx[t];
      return idx != null ? (ecmwfValues[idx] ?? null) : null;
    });

    // Only overwrite if the ECMWF data has at least one non-null value
    if (aligned.some(v => v != null)) {
      if (!weather.hourly) weather.hourly = {};
      weather.hourly[field] = aligned;
    }
  }

  return weather;
}

export function run({ $input }: N8nRuntime) {
  const input = firstInputJson($input, {} as Record<string, any>);

  const weather = mergeEcmwfSupplement(
    input.weather ?? EMPTY_WEATHER,
    input.ecmwfSupplement ?? EMPTY_HOURLY,
  );

  return [{
    json: {
      weather,
      airQuality: input.airQuality ?? EMPTY_HOURLY,
      metarRaw: input.metarRaw ?? [],
      sunsetHue: input.sunsetHue ?? [],
      precipProb: input.precipProb ?? EMPTY_HOURLY,
      ensemble: input.ensemble ?? EMPTY_HOURLY,
      azimuthByPhase: input.azimuthByPhase ?? {},
      nowcastSatellite: input.nowcastSatellite ?? undefined,
      marine: input.marine ?? EMPTY_HOURLY,
    },
  }];
}
