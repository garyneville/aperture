import { scoreAlternatives } from '../../lib/score-alternatives.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const mergedItems = (() => {
    try {
      return $input.all().map(item => item.json);
    } catch {
      return [];
    }
  })();

  const altWeatherData = mergedItems.map(({ name: _name, lat: _lat, lon: _lon, driveMins: _driveMins, types: _types, siteDarkness: _siteDarkness, darkSky: _darkSky, elevationM: _elevationM, isUpland: _isUpland, mwisArea: _mwisArea, url: _url, homeContext: _homeContext, ...weather }) => weather);
  const altLocationMeta = mergedItems.map(({ name, lat, lon, driveMins, types, siteDarkness, darkSky, elevationM, isUpland, mwisArea }) => ({ name, lat, lon, driveMins, types, siteDarkness, darkSky, elevationM: elevationM ?? 0, isUpland: isUpland ?? false, mwisArea: mwisArea ?? null }));
  const homeContext = mergedItems[0]?.homeContext ?? {};

  const result = scoreAlternatives({
    altWeatherData,
    altLocationMeta,
    homeContext,
  });

  return [{ json: {
    altLocations: result.altLocations,
    closeContenders: result.closeContenders,
    noAltsMsg: result.noAltsMsg,
    windows: homeContext.windows,
    dontBother: homeContext.dontBother,
    todayBestScore: homeContext.todayBestScore,
    todayCarWash: homeContext.todayCarWash,
    dailySummary: result.augmentedSummary,
    metarNote: homeContext.metarNote,
    sunrise: homeContext.sunrise,
    sunset: homeContext.sunset,
    moonPct: homeContext.moonPct,
    debugContext: result.debugContext,
  } }];
}
