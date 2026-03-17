import { buildPrompt } from '../../core/build-prompt.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const input = $input.first().json;

  const result = buildPrompt({
    windows: input.windows,
    dontBother: input.dontBother,
    todayBestScore: input.todayBestScore,
    todayCarWash: input.todayCarWash,
    dailySummary: input.dailySummary,
    altLocations: input.altLocations,
    noAltsMsg: input.noAltsMsg,
    metarNote: input.metarNote,
    sunrise: input.sunrise,
    sunset: input.sunset,
    moonPct: input.moonPct,
    kpForecast: input.kpForecast,
    auroraSignal: input.auroraSignal,
    debugContext: input.debugContext,
    longRangeTop: input.longRangeTop,
    longRangeCardLabel: input.longRangeCardLabel,
    darkSkyAlert: input.darkSkyAlert,
    longRangeCandidates: input.longRangeCandidates,
    longRangeDebugCandidates: input.longRangeDebugCandidates,
  });

  return [{ json: result }];
}
