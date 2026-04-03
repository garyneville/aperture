import { scoreLongRange } from '../../domain/scoring/score-long-range.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const mergedItems = (() => {
    try {
      return $input.all().map(item => item.json);
    } catch {
      return [];
    }
  })();

  const longRangeWeatherData = mergedItems.map(({ name: _n, lat: _la, lon: _lo, region: _r, elevation: _e, tags: _t, siteDarkness: _sd, darkSky: _d, driveMins: _dm, url: _u, homeContext: _hc, ...weather }) => weather);
  const longRangeMeta = mergedItems.map(({ name, lat, lon, region, elevation, tags, siteDarkness, darkSky, driveMins }) => ({ name, lat, lon, region, elevation, tags, siteDarkness, darkSky, driveMins }));
  const homeContext = mergedItems[0]?.homeContext ?? {};
  const homeHeadlineScore = homeContext.dailySummary?.[0]?.headlineScore ?? homeContext.dailySummary?.[0]?.photoScore ?? 0;
  const homeLocationName = homeContext.debugContext?.metadata?.location;
  const timezone = homeContext.debugContext?.metadata?.timezone;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  const result = scoreLongRange({
    longRangeWeatherData,
    longRangeMeta,
    homeHeadlineScore,
    homeLocationName,
    timezone,
    isWeekday,
  });

  return [{ json: {
    longRangeTop: result.longRangeTop,
    longRangeCardLabel: result.cardLabel,
    darkSkyAlert: result.darkSkyAlert,
    longRangeCandidates: result.longRangeCandidates,
    longRangeDebugCandidates: result.longRangeDebugCandidates,
  } }];
}
