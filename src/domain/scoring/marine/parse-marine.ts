import type { MarineData } from '../contracts.js';

export interface MarineHourLookup {
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  wavePeakPeriodS: number | null;
}

/**
 * Build a per-timestamp lookup from raw MarineData.
 *
 * Returns a Record keyed by ISO timestamp string so callers can merge
 * marine fields into feature inputs during the scoring loop.
 */
export function parseMarineData(
  marine: MarineData | undefined,
): Record<string, MarineHourLookup> {
  const result: Record<string, MarineHourLookup> = {};
  if (!marine?.hourly?.time) return result;

  const times = marine.hourly.time;
  const height = marine.hourly.wave_height ?? [];
  const direction = marine.hourly.wave_direction ?? [];
  const period = marine.hourly.wave_period ?? [];
  const peakPeriod = marine.hourly.wave_peak_period ?? [];

  for (let i = 0; i < times.length; i++) {
    const ts = times[i];
    if (!ts) continue;
    result[ts] = {
      waveHeightM: height[i] ?? null,
      waveDirectionDeg: direction[i] ?? null,
      wavePeriodS: period[i] ?? null,
      wavePeakPeriodS: peakPeriod[i] ?? null,
    };
  }

  return result;
}
