/**
 * Per-location scoring across forecast days.
 *
 * Scores a single alternative location across all forecast days,
 * extracting the best daylight and astro scores.
 */

import { HOME_SITE_DARKNESS } from '../site-darkness.js';
import type { AltLocation } from '../prepare-alt-locations.js';
import { evaluateDay } from '../shared-scoring.js';
import type { AltWeatherData, LocDayScore } from './types.js';
import { DAY_THRESHOLD, ASTRO_THRESHOLD } from './types.js';

interface DateEntry {
  ts: string;
  i: number;
}

/**
 * Score a single location across all forecast days.
 *
 * @param wData - Weather data for this location
 * @param loc - Location metadata
 * @param timezone - Timezone for date calculations
 * @returns Array of per-day scores
 */
export function scoreLocation(
  wData: AltWeatherData,
  loc: AltLocation,
  timezone: string,
): LocDayScore[] {
  // Group hourly data by date
  const byDate: Record<string, DateEntry[]> = {};
  (wData.hourly?.time || []).forEach((ts, i) => {
    const d = new Date(ts).toLocaleDateString('en-CA', { timeZone: timezone });
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push({ ts, i });
  });

  const days: LocDayScore[] = [];

  Object.keys(byDate).sort().slice(0, 5).forEach((dateKey, dayIdx) => {
    const sunriseD = new Date(
      wData.daily?.sunrise?.[dayIdx] || new Date(dateKey + 'T06:30:00Z').toISOString(),
    );
    const sunsetD = new Date(
      wData.daily?.sunset?.[dayIdx] || new Date(dateKey + 'T18:30:00Z').toISOString(),
    );

    // Accumulate snow data
    let maxSnowDepthM = 0;
    let totalSnowfallCm = 0;
    let hasSnowData = false;
    for (const { i } of byDate[dateKey]) {
      const snowDepthM = wData.hourly!.snow_depth?.[i];
      const snowfallHr = wData.hourly!.snowfall?.[i];
      if (snowDepthM !== undefined || snowfallHr !== undefined) {
        hasSnowData = true;
        if (snowDepthM !== undefined) maxSnowDepthM = Math.max(maxSnowDepthM, snowDepthM);
        if (snowfallHr !== undefined) totalSnowfallCm += snowfallHr;
      }
    }

    // Use shared evaluation pipeline for the core scoring
    const eval_ = evaluateDay(wData, loc, byDate[dateKey], sunriseD, sunsetD, timezone);

    // Determine if location meets threshold for display
    const meetsThreshold = (eval_.bestDay >= DAY_THRESHOLD)
      || (loc.siteDarkness.siteDarknessScore > HOME_SITE_DARKNESS.siteDarknessScore && eval_.bestAstro >= ASTRO_THRESHOLD);

    // Convert snow data to output format
    // snow_depth is in metres; convert to cm
    // snowfall is in cm/hr; sum gives total cm for the day
    const snowDepthCm = hasSnowData && maxSnowDepthM > 0 ? Math.round(maxSnowDepthM * 100) : null;
    const snowfallCm = hasSnowData && totalSnowfallCm > 0 ? Math.round(totalSnowfallCm * 10) / 10 : null;

    days.push({
      dateKey,
      dayIdx,
      bestDay: eval_.bestDay,
      bestAstro: eval_.bestAstro,
      bestScore: eval_.bestScore,
      bestDayHour: eval_.bestDayHour,
      bestAstroHour: eval_.bestAstroHour,
      bestTags: eval_.bestTags,
      amScore: eval_.amScore,
      pmScore: eval_.pmScore,
      isAstroWin: eval_.isAstroWin,
      meetsThreshold,
      snowDepthCm,
      snowfallCm,
    });
  });

  return days;
}

/**
 * Transform a location's today score into a TodayAlt candidate.
 *
 * @param loc - Location metadata
 * @param today - Today's score data
 * @returns TodayAlt candidate
 */
export function toTodayAlt(loc: AltLocation, today: LocDayScore): import('./types.js').TodayAlt {
  return {
    name: loc.name,
    driveMins: loc.driveMins,
    types: today.bestTags?.length ? today.bestTags : loc.types,
    siteDarkness: loc.siteDarkness,
    darkSky: loc.darkSky,
    dayScore: today.bestDay,
    astroScore: today.bestAstro,
    bestScore: today.bestScore,
    bestDayHour: today.bestDayHour,
    bestAstroHour: today.bestAstroHour,
    amScore: today.amScore,
    pmScore: today.pmScore,
    isAstroWin: today.isAstroWin,
    meetsThreshold: today.meetsThreshold,
    elevationM: loc.elevationM,
    isUpland: loc.isUpland,
    snowDepthCm: today.snowDepthCm,
    snowfallCm: today.snowfallCm,
  };
}
