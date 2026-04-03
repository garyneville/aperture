import { emptyDebugContext, type DebugContext } from '../../lib/debug-context.js';
import type { SessionRecommendationSummary } from '../../types/session-score.js';

// Re-export types from submodules for backward compatibility
export type {
  ScoredHour,
  Window,
  WindowSelectionSource,
  WindowCandidate,
  DailySummary,
  CarWash,
  BestWindowsInput,
  BestWindowsOutput,
} from './best-windows/types.js';

// Import from submodules
import {
  PHOTO_THRESHOLD,
  STRONG_SESSION_FALLBACK_SCORE,
  SESSION_FALLBACK_MARGIN,
  type ScoredHour,
  type Window,
  type WindowCandidate,
  type DailySummary,
  type CarWash,
  type BestWindowsInput,
  type BestWindowsOutput,
} from './best-windows/types.js';

import { groupWindows } from './best-windows/grouping.js';
import { buildFallbackWindow, buildSessionFallbackWindow } from './best-windows/fallback.js';
import { labelWindow, headlineTagsForWindow } from './best-windows/labeling.js';
import { alignTodaySummaryWithWindow } from './best-windows/alignment.js';
import { annotateDarkPhase } from './best-windows/dark-phase.js';
import { expandCollapsedDaylightWindow } from './best-windows/expansion.js';

export function bestWindows(input: BestWindowsInput): BestWindowsOutput {
  const { todayHours, dailySummary, metarNote, sessionRecommendation } = input;

  // Group hours above threshold into windows
  let windows = groupWindows(todayHours);

  // Expand single-hour daylight windows
  windows = windows.map(window => expandCollapsedDaylightWindow(window, todayHours));

  // If no threshold windows, try fallback selection
  if (!windows.length) {
    const fallback = buildFallbackWindow(todayHours);
    const sessionFallback = buildSessionFallbackWindow(todayHours, sessionRecommendation);
    const fallbackToUse = sessionFallback && (!fallback || sessionFallback.peak >= fallback.peak + SESSION_FALLBACK_MARGIN)
      ? sessionFallback
      : (fallback || sessionFallback);
    if (fallbackToUse) windows = [fallbackToUse];
  }

  const sunrise = dailySummary[0]?.sunrise;
  const sunset = dailySummary[0]?.sunset;
  const darkSkyStartsAt = dailySummary[0]?.darkSkyStartsAt;

  // Label windows and annotate with dark phase info
  const labelledWindows: Window[] = windows
    .map(w => annotateDarkPhase(w, darkSkyStartsAt))
    .map(w => ({
      ...w,
      label: labelWindow(w, sunrise, sunset),
    }));

  // Align summary with selected window
  const alignedDailySummary = alignTodaySummaryWithWindow(dailySummary, labelledWindows);

  // Determine final scores and dontBother status
  const hasLocalWindow = labelledWindows.length > 0;
  const todayHeadline = alignedDailySummary[0]?.headlineScore ?? alignedDailySummary[0]?.photoScore ?? 0;
  const primarySelectionSource = windows[0]?.selectionSource;
  const strongSessionFallback = primarySelectionSource === 'session-fallback';

  const todayBestScore = hasLocalWindow
    ? Math.min(strongSessionFallback ? todayHeadline : Math.max(labelledWindows[0].peak, todayHeadline), labelledWindows[0].peak)
    : Math.min(todayHeadline, PHOTO_THRESHOLD - 1);

  const dontBother = !hasLocalWindow || (!strongSessionFallback && todayBestScore < PHOTO_THRESHOLD);

  const todayCarWash = alignedDailySummary[0]?.carWash || {
    score: 0, rating: '\u274c', label: 'No good window',
    start: '\u2014', end: '\u2014', wind: 0, pp: 0, tmp: 0,
  };

  // Build debug context
  const debugContext = input.debugContext || emptyDebugContext();
  debugContext.windows = labelledWindows.map((window, index) => {
    const selected = index === 0;
    const scoreGap = selected ? 0 : Math.max(0, labelledWindows[0].peak - window.peak);
    const source = windows[index]?.selectionSource;
    const selectionReason = selected
      ? (source === 'session-fallback'
          ? 'selected from the strongest session recommendation after no clean threshold window emerged'
          : window.fallback
            ? 'selected as the strongest fallback session after no clean threshold window emerged'
            : 'selected as the highest-scoring local window')
      : (window.fallback
          ? 'kept as a backup fallback session'
          : `kept as backup window; ${scoreGap} point${scoreGap === 1 ? '' : 's'} below the selected slot`);

    return {
      label: window.label,
      start: window.start,
      end: window.end,
      peak: window.peak,
      rank: index + 1,
      selected,
      fallback: window.fallback,
      selectionReason,
      darkPhaseStart: window.darkPhaseStart ?? null,
      postMoonsetScore: window.postMoonsetScore ?? null,
    };
  });

  return {
    windows: labelledWindows,
    dontBother,
    todayBestScore,
    todayCarWash,
    dailySummary: alignedDailySummary,
    metarNote,
    sessionRecommendation,
    sunrise,
    sunset,
    moonPct: todayHours[0]?.moon ?? 0,
    debugContext,
  };
}

// Re-export helper for external use
export { headlineTagsForWindow };
