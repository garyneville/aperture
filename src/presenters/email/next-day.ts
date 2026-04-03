/**
 * Next Day Outdoor Outlook
 *
 * This file is now a compatibility layer that re-exports from the split modules:
 * - outdoor-comfort.ts: Pure scoring/labels/reasons
 * - outdoor-outlook-model.ts: Filtering, contiguous windows, summary building
 * - render-outdoor-outlook.ts: HTML rendering
 *
 * The remaining functions in this file (photoForecastCards, daylightUtilityTodayCard)
 * are separate concerns that may be moved in future refactoring.
 */

import { esc } from '../../lib/utils.js';
import { clockToMinutes, minutesToClock } from '../../domain/windowing/index.js';
import {
  C,
  FONT,
  UTILITY_GLYPHS,
  card,
  confidenceDetail,
  daylightUtilityLine,
  dayHeading,
  effectiveConf,
  metricChip,
  moonIconForPct,
  pill,
  scoreState,
} from './shared.js';
import { bestDaySessionLabel, forecastBestLine } from './time-aware.js';
import type { CarWash, DaySummary, NextDayHour, RunTimeContext, Window } from './types.js';
import { renderNextDayHourlyOutlook, renderRemainingTodayOutlook } from './render-outdoor-outlook.js';

// Re-export from shared presenter layer for backwards compatibility
export {
  outdoorComfortScore,
  outdoorComfortLabel,
  outdoorComfortReason,
  outdoorComfortReasonCodes,
  COMFORT_SCORE_CONFIG,
  RUN_FRIENDLY_THRESHOLDS,
  COMFORT_REASON_THRESHOLDS,
  type ComfortLabel,
  type ComfortReasonCode,
} from '../shared/outdoor-comfort.js';

export {
  buildOutdoorOutlookModel,
  formatPhotoWindowList,
  type OutdoorOutlookRow,
  type OutdoorOutlookOptions,
  type OutdoorOutlookModel,
} from '../shared/outdoor-outlook-model.js';

/**
 * @deprecated Use renderNextDayHourlyOutlook from './render-outdoor-outlook.js'
 */
export function nextDayHourlyOutlookSection(
  tomorrow: DaySummary | undefined,
  debugContext?: import('../../lib/debug-context.js').DebugContext,
  options: Partial<import('./outdoor-outlook-model.js').OutdoorOutlookOptions> & { title?: string; caption?: string } = {},
): string {
  return renderNextDayHourlyOutlook(tomorrow, debugContext, options);
}

/**
 * @deprecated Use renderRemainingTodayOutlook from './render-outdoor-outlook.js'
 */
export function remainingTodayHourlyOutlookSection(
  today: DaySummary | undefined,
  runTime: RunTimeContext,
  photoWindows: Window[],
  debugContext?: import('../../lib/debug-context.js').DebugContext,
): string {
  return renderRemainingTodayOutlook(today, runTime, photoWindows, debugContext);
}

// =============================================================================
// Photo Forecast Cards (separate concern - may move to own module in future)
// =============================================================================

function forecastMoonPct(day: DaySummary): number | null {
  const hours = day.hours || [];
  const bestAstroHour = day.bestAstroHour
    ? hours.find(hour => hour.hour === day.bestAstroHour && typeof hour.moon === 'number')
    : null;
  const representativeHour =
    bestAstroHour ||
    hours.find(hour => hour.isNight && typeof hour.moon === 'number') ||
    hours.find(hour => typeof hour.moon === 'number') ||
    null;
  return typeof representativeHour?.moon === 'number' ? Math.round(representativeHour.moon) : null;
}

export function photoForecastCards(dailySummary: DaySummary[]): string {
  const forecastDays = dailySummary.filter(day => day.dayIdx >= 1).slice(0, 4);

  return forecastDays
    .map(day => {
      const dayIsAstroLed = (day.astroScore ?? 0) > (day.photoScore ?? 0);
      const { confidence: effectiveConfidence } = effectiveConf(day, dayIsAstroLed);
      const displayScore = day.headlineScore ?? day.photoScore;

      const bestAltHour = day.bestAlt?.isAstroWin
        ? day.bestAlt.bestAstroHour
        : day.bestAlt?.bestDayHour;

      const scoreStr = typeof displayScore === 'number' ? `${displayScore}/100` : '-';
      const confState = confidenceDetail(effectiveConfidence);
      const moonPct = forecastMoonPct(day);

      const moonLine =
        moonPct !== null
          ? `${moonIconForPct(moonPct, 12)} <span style="vertical-align:middle;">Moon ${moonPct}% lit</span>`
          : '';

      const spreadNote = dayIsAstroLed
        ? day.astroConfidenceStdDev !== null && day.astroConfidenceStdDev !== undefined
          ? ` · spread ${day.astroConfidenceStdDev}`
          : ''
        : day.confidenceStdDev !== null && day.confidenceStdDev !== undefined
          ? ` · spread ${day.confidenceStdDev}`
          : '';

      const confText = confState
        ? `<span style="color:${confState.fg};">${confState.label}${spreadNote}</span>`
        : '';

      const altLine = day.bestAlt
        ? `Backup: ${day.bestAlt.name} · ${day.bestAlt.bestScore}/100${bestAltHour ? ` at ${bestAltHour}` : ''}${day.bestAlt.isAstroWin ? ' (astro)' : ''}${typeof day.bestAlt.driveMins === 'number' ? ` · ${day.bestAlt.driveMins} min drive` : ''}`
        : '';

      return card(`
        <div style="font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">${esc(dayHeading(day))} &middot; ${scoreState(displayScore).label} (${scoreStr})</div>
        <div style="Margin-top:8px;font-family:${FONT};font-size:14px;font-weight:600;line-height:1.5;color:${C.ink};">${esc(forecastBestLine(day))}</div>
        <div style="Margin-top:10px;">
          ${metricChip('AM', day.amScore ?? 0, scoreState(day.amScore ?? 0).fg)}
          ${metricChip('PM', day.pmScore ?? 0, scoreState(day.pmScore ?? 0).fg)}
          ${metricChip('Astro', day.astroScore ?? 0, scoreState(day.astroScore ?? 0).fg)}
          ${confText ? `<span style="font-family:${FONT};font-size:11px;font-weight:600;margin-left:4px;">${confText}</span>` : ''}
        </div>
        ${moonLine ? `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.secondary};">${moonLine}</div>` : ''}
        ${altLine ? `<div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(altLine)}</div>` : ''}
        <div style="Margin-top:8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${daylightUtilityLine(day.carWash)}</div>
      `);
    })
    .join('<div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>');
}

// =============================================================================
// Daylight Utility Card (separate concern - may move to own module in future)
// =============================================================================

export function daylightUtilityTodayCard(todayCarWash: CarWash, runTime: RunTimeContext): string {
  const startMinutes = clockToMinutes(todayCarWash.start);
  const endMinutes = clockToMinutes(todayCarWash.end);
  const isPast = startMinutes !== null && endMinutes !== null && endMinutes < runTime.nowMinutes;

  if (isPast) return '';

  const state =
    todayCarWash.score >= 75
      ? { fg: C.success, bg: C.successContainer, border: '#A3D9B1' }
      : todayCarWash.score >= 50
        ? { fg: C.onPrimaryContainer, bg: C.primaryContainer, border: '#A8D4FB' }
        : { fg: C.error, bg: C.errorContainer, border: '#ECACA5' };

  const isOngoing =
    startMinutes !== null &&
    endMinutes !== null &&
    startMinutes <= runTime.nowMinutes &&
    endMinutes >= runTime.nowMinutes;

  const clippedStart = isOngoing
    ? minutesToClock(
        runTime.nowMinutes % 60 === 0
          ? runTime.nowMinutes
          : runTime.nowMinutes + (60 - (runTime.nowMinutes % 60)),
      )
    : todayCarWash.start;

  const window = todayCarWash.start !== '\u2014' ? `${clippedStart}–${todayCarWash.end}` : '\u2014';
  const utilityLabel = isOngoing ? 'Daylight utility now' : 'Daylight utility';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${C.surfaceVariant};border-radius:10px;">
    <tr>
      <td style="padding:10px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle">
              <span style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:${C.subtle};">${utilityLabel}</span>
              <span style="font-family:${FONT};font-size:13px;font-weight:600;color:${C.ink};margin-left:10px;">${UTILITY_GLYPHS} ${esc(window)}</span>
            </td>
            <td align="right" valign="middle">
              ${pill(`${todayCarWash.rating} ${todayCarWash.label}`, state.fg, state.bg, state.border)}
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:7px;">
              ${metricChip('Wind', `${todayCarWash.wind}km/h`, C.tertiary)}
              ${metricChip('Rain', `${todayCarWash.pp}%`, C.error)}
              ${metricChip('Temp', `${todayCarWash.tmp}°C`, C.secondary)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}
