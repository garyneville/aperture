import { scoreAlternatives } from '../../core/score-alternatives.js';
import type { N8nRuntime } from './types.js';

export function run({ $, $input }: N8nRuntime) {
  const altWeatherData = $input.all().map(item => item.json);
  const altLocationMeta = $('Code: Prepare Alt Locations').all().map(item => item.json);
  const leedsContext = $('Code: Best Windows').first().json;

  const result = scoreAlternatives({
    altWeatherData,
    altLocationMeta,
    leedsContext,
  });

  return [{ json: {
    altLocations: result.altLocations,
    noAltsMsg: result.noAltsMsg,
    windows: leedsContext.windows,
    dontBother: leedsContext.dontBother,
    todayBestScore: leedsContext.todayBestScore,
    todayCarWash: leedsContext.todayCarWash,
    dailySummary: result.augmentedSummary,
    metarNote: leedsContext.metarNote,
    sunrise: leedsContext.sunrise,
    sunset: leedsContext.sunset,
    moonPct: leedsContext.moonPct,
  } }];
}
