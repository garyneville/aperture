import { scoreAlternatives } from '../../core/score-alternatives.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const mergedItems = (() => {
    try {
      return $input.all().map(item => item.json);
    } catch {
      return [];
    }
  })();

  const altWeatherData = mergedItems.map(({ name: _name, lat: _lat, lon: _lon, driveMins: _driveMins, types: _types, siteDarkness: _siteDarkness, darkSky: _darkSky, elevationM: _elevationM, isUpland: _isUpland, mwisArea: _mwisArea, url: _url, leedsContext: _leedsContext, ...weather }) => weather);
  const altLocationMeta = mergedItems.map(({ name, lat, lon, driveMins, types, siteDarkness, darkSky, elevationM, isUpland, mwisArea }) => ({ name, lat, lon, driveMins, types, siteDarkness, darkSky, elevationM: elevationM ?? 0, isUpland: isUpland ?? false, mwisArea: mwisArea ?? null }));
  const leedsContext = mergedItems[0]?.leedsContext ?? {};

  const result = scoreAlternatives({
    altWeatherData,
    altLocationMeta,
    leedsContext,
  });

  return [{ json: {
    altLocations: result.altLocations,
    closeContenders: result.closeContenders,
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
    debugContext: result.debugContext,
  } }];
}
