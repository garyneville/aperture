import { scoreLongRange } from '../../core/score-long-range.js';
import type { N8nRuntime } from './types.js';

export function run({ $input }: N8nRuntime) {
  const mergedItems = (() => {
    try {
      return $input.all().map(item => item.json);
    } catch {
      return [];
    }
  })();

  const longRangeWeatherData = mergedItems.map(({ name: _n, lat: _la, lon: _lo, region: _r, elevation: _e, tags: _t, siteDarkness: _sd, darkSky: _d, driveMins: _dm, url: _u, leedsContext: _lc, ...weather }) => weather);
  const longRangeMeta = mergedItems.map(({ name, lat, lon, region, elevation, tags, siteDarkness, darkSky, driveMins }) => ({ name, lat, lon, region, elevation, tags, siteDarkness, darkSky, driveMins }));
  const leedsContext = mergedItems[0]?.leedsContext ?? {};
  const leedsHeadlineScore = leedsContext.dailySummary?.[0]?.headlineScore ?? leedsContext.dailySummary?.[0]?.photoScore ?? 0;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  const result = scoreLongRange({
    longRangeWeatherData,
    longRangeMeta,
    leedsHeadlineScore,
    isWeekday,
  });

  return [{ json: result }];
}
