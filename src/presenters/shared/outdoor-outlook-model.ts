/**
 * Outdoor Outlook Model
 *
 * Builds the data model for outdoor outlook displays.
 * Handles filtering, window selection, and summary generation.
 *
 * This module contains the algorithmic logic for determining
 * best outdoor windows and building outlook summaries.
 *
 * This module was moved from ../email/outdoor-outlook-model.ts to enable
 * sharing across multiple presenters (email, site, etc.).
 */

import { clockToMinutes, windowRange } from '../../domain/windowing/index.js';
import type { NextDayHour, Window, DaySummary } from '../../types/brief.js';
import {
  outdoorComfortScore,
  outdoorComfortLabel,
  outdoorComfortReason,
  type ComfortLabel,
} from './outdoor-comfort.js';

/**
 * A row in the outdoor outlook table.
 */
export interface OutdoorOutlookRow {
  hour: NextDayHour;
  score: number;
  label: ComfortLabel;
  reason: string;
}

/**
 * Options for building the outdoor outlook model.
 */
export interface OutdoorOutlookOptions {
  summaryContext: 'today' | 'tomorrow';
  startAtMinutes?: number | null;
  showOvernight?: boolean;
  photoWindows?: Window[];
}

/**
 * The complete outdoor outlook model.
 */
export interface OutdoorOutlookModel {
  hours: NextDayHour[];
  rows: OutdoorOutlookRow[];
  dayRows: OutdoorOutlookRow[];
  bestWindow: { start: string; end: string; label: string } | null;
  summaryLine: string;
}

/**
 * Check if an hour falls within a photo window.
 */
function hourFallsWithinPhotoWindow(hour: string, window: Window): boolean {
  const hourMinutes = clockToMinutes(hour);
  const startMinutes = clockToMinutes(window.start);
  const endMinutes = clockToMinutes(window.end);

  if (hourMinutes === null || startMinutes === null || endMinutes === null) return false;

  // Window crosses midnight
  if (endMinutes < startMinutes) {
    return hourMinutes >= startMinutes || hourMinutes <= endMinutes;
  }

  return hourMinutes >= startMinutes && hourMinutes <= endMinutes;
}

/**
 * Determine if an outdoor hour should be displayed.
 */
function shouldDisplayOutdoorHour(
  hour: NextDayHour,
  showOvernight: boolean,
  photoWindows: Window[] = [],
): boolean {
  if (showOvernight) return true;
  if (photoWindows.some(window => hourFallsWithinPhotoWindow(hour.hour, window))) return true;

  const minutes = clockToMinutes(hour.hour) ?? 0;
  // Show evening hours (18:00-23:00) even if marked as night
  return !hour.isNight || (minutes >= 18 * 60 && minutes < 23 * 60);
}

/**
 * Format photo windows for display.
 */
function formatPhotoWindowList(windows: Window[]): string {
  return windows.map(window => `${window.label} ${windowRange(window)}`).join(' · ');
}

/**
 * Find contiguous runs of items matching a predicate.
 */
function findContiguousRuns<T>(
  items: T[],
  predicate: (item: T) => boolean,
): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = [];
  let start = -1;

  for (let index = 0; index < items.length; index++) {
    if (predicate(items[index])) {
      if (start === -1) start = index;
      continue;
    }
    if (start !== -1) {
      runs.push({ start, end: index - 1 });
      start = -1;
    }
  }

  if (start !== -1) {
    runs.push({ start, end: items.length - 1 });
  }

  return runs;
}

/**
 * Find the best outdoor window from outlook rows.
 *
 * Uses a scoring algorithm that prioritizes:
 * 1. Peak comfort score in the run
 * 2. Average comfort score
 * 3. Length of the run
 * 4. Earliest start time (tiebreaker)
 */
function findBestOutdoorWindow(
  rows: OutdoorOutlookRow[],
): { start: string; end: string; label: string } | null {
  const highlightedRows = rows.filter(row => row.label.highlight);
  if (!highlightedRows.length) return null;

  const peakScore = Math.max(...highlightedRows.map(row => row.score));
  const focusedThreshold = Math.max(55, peakScore - 10);

  // Try focused runs first (high score), then fallback to any highlighted
  const focusedRuns = findContiguousRuns(
    rows,
    row => row.label.highlight && row.score >= focusedThreshold,
  );
  const fallbackRuns = findContiguousRuns(rows, row => row.label.highlight);
  const candidateRuns = focusedRuns.length ? focusedRuns : fallbackRuns;

  if (!candidateRuns.length) return null;

  // Score each run and pick the best
  const [bestRun] = candidateRuns
    .map(run => {
      const runRows = rows.slice(run.start, run.end + 1);
      const peak = Math.max(...runRows.map(row => row.score));
      const average = runRows.reduce((sum, row) => sum + row.score, 0) / runRows.length;
      return { ...run, peak, average, length: runRows.length };
    })
    .sort((left, right) => (
      right.peak - left.peak ||
      right.average - left.average ||
      right.length - left.length ||
      left.start - right.start
    ));

  const runRows = rows.slice(bestRun.start, bestRun.end + 1);
  const topRow = runRows.reduce((best, row) => (row.score > best.score ? row : best));

  return {
    start: rows[bestRun.start].hour.hour,
    end: rows[bestRun.end].hour.hour,
    label: topRow.label.text,
  };
}

/**
 * Generate a summary line for the outdoor outlook.
 */
function buildOutdoorSummaryLine(
  bestWindow: { start: string; end: string; label: string } | null,
  hours: NextDayHour[],
  summaryContext: 'today' | 'tomorrow',
): string {
  if (!hours.length) {
    return summaryContext === 'today'
      ? 'No useful outdoor hours remain today.'
      : 'No forecast data available for tomorrow.';
  }

  const dayHours = hours.filter(hour => !hour.isNight);
  if (!dayHours.length) {
    return summaryContext === 'today'
      ? 'No daytime outdoor hours remain today.'
      : "No daytime hours in tomorrow's forecast.";
  }

  const avgTmp = Math.round(dayHours.reduce((sum, hour) => sum + hour.tmp, 0) / dayHours.length);
  const maxPp = Math.max(...dayHours.map(hour => hour.pp));
  const maxWind = Math.max(...dayHours.map(hour => hour.wind));

  const rainNote =
    maxPp > 60 ? 'heavy rain likely' :
    maxPp > 30 ? 'some rain likely' :
    maxPp > 10 ? 'chance of showers' :
    'mostly dry';

  const windNote =
    maxWind > 40 ? ' with strong winds' :
    maxWind > 25 ? ' with breezy spells' :
    '';

  const capitalizedRain = rainNote.charAt(0).toUpperCase() + rainNote.slice(1);

  if (bestWindow) {
    const windowText =
      summaryContext === 'today'
        ? `Best remaining outdoor window: ${bestWindow.start}–${bestWindow.end}.`
        : `Best outdoor window: ${bestWindow.start}–${bestWindow.end}.`;
    return `${capitalizedRain}${windNote}. Around ${avgTmp}°C. ${windowText}`;
  }

  return `${capitalizedRain}${windNote}. Around ${avgTmp}°C. Limited outdoor opportunities.`;
}

/**
 * Build the outdoor outlook model from day summary data.
 *
 * This is the main entry point for outdoor outlook generation.
 * It filters hours, calculates comfort scores, finds best windows,
 * and builds the complete model.
 *
 * @param day - Day summary with hourly forecast data
 * @param options - Configuration options
 * @returns Complete outdoor outlook model or null if no valid hours
 */
export function buildOutdoorOutlookModel(
  day: DaySummary | undefined,
  options: Partial<OutdoorOutlookOptions> = {},
): OutdoorOutlookModel | null {
  const config: OutdoorOutlookOptions = {
    summaryContext: 'tomorrow',
    startAtMinutes: null,
    showOvernight: false,
    photoWindows: [],
    ...options,
  };

  // Filter hours based on start time and display rules
  const hours = (day?.hours || [])
    .filter(hour =>
      config.startAtMinutes === null ||
      config.startAtMinutes === undefined ||
      (clockToMinutes(hour.hour) ?? -1) >= config.startAtMinutes,
    )
    .filter(hour =>
      shouldDisplayOutdoorHour(hour, Boolean(config.showOvernight), config.photoWindows || []),
    );

  if (!hours.length) return null;

  // Build outlook rows with comfort scores
  const rows = hours.map(hour => {
    const score = outdoorComfortScore(hour);
    const label = outdoorComfortLabel(score, hour);
    const reason = outdoorComfortReason(hour);
    return { hour, score, label, reason };
  });

  const dayRows = rows.filter(({ hour }) => !hour.isNight);
  const bestWindow = findBestOutdoorWindow(dayRows);

  return {
    hours,
    rows,
    dayRows,
    bestWindow,
    summaryLine: buildOutdoorSummaryLine(bestWindow, hours, config.summaryContext),
  };
}

// Re-export for consumers who need both
export { formatPhotoWindowList };
