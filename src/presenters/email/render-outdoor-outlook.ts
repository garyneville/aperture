/**
 * Render Outdoor Outlook
 *
 * HTML rendering for outdoor outlook sections.
 * Pure presentation logic - no scoring or algorithmic decisions.
 */

import type { DebugContext, DebugOutdoorComfortHour } from '../../lib/debug-context.js';
import { esc } from '../../lib/utils.js';
import { clockToMinutes, minutesToClock } from '../../domain/windowing/index.js';
import { C, FONT, card, weatherIconForHour } from './shared.js';
import type { DaySummary, RunTimeContext, Window } from './types.js';
import type { OutdoorOutlookModel, OutdoorOutlookOptions } from '../shared/outdoor-outlook-model.js';
import { buildOutdoorOutlookModel, formatPhotoWindowList } from '../shared/outdoor-outlook-model.js';

/**
 * Options for rendering the hourly outlook section.
 */
interface HourlyOutlookSectionOptions extends OutdoorOutlookOptions {
  title: string;
  caption: string;
}

/**
 * Render the outdoor outlook HTML table rows.
 */
function renderOutdoorOutlookRows(rows: OutdoorOutlookModel['rows']): string {
  return rows
    .map(({ hour, score, label, reason }) => {
      const rowBg = label.highlight ? label.bg : 'transparent';
      const textColor = label.highlight ? label.fg : C.muted;
      const indicatorDot = label.highlight
        ? `<span style="color:${label.fg};font-size:14px;">&#x25CF;</span>&ensp;`
        : `<span style="color:${C.outline};font-size:14px;">&#x25CB;</span>&ensp;`;

      return `<tr style="background:${rowBg};">
        <td valign="middle" style="padding:6px 8px;font-family:${FONT};font-size:12px;font-weight:600;color:${C.ink};white-space:nowrap;">${esc(hour.hour)}</td>
        <td valign="middle" style="padding:6px 4px;text-align:center;white-space:nowrap;">${weatherIconForHour(hour)}</td>
        <td valign="middle" style="padding:6px 6px;font-family:${FONT};font-size:12px;color:${C.ink};white-space:nowrap;">${esc(String(Math.round(hour.tmp)))}°C</td>
        <td valign="middle" style="padding:6px 6px;font-family:${FONT};font-size:12px;color:${C.ink};white-space:nowrap;">${esc(String(hour.pp))}%</td>
        <td valign="middle" style="padding:6px 6px;font-family:${FONT};font-size:12px;color:${C.ink};white-space:nowrap;">${esc(String(hour.wind))}km/h</td>
        <td valign="middle" style="padding:6px 8px 6px 6px;font-family:${FONT};font-size:12px;color:${textColor};">${indicatorDot}${esc(label.text)}</td>
        <td valign="middle" style="padding:6px 8px 6px 2px;font-family:${FONT};font-size:11px;color:${C.subtle};white-space:nowrap;">
          <div>${score}/100</div>
          ${reason ? `<div style="font-size:10px;color:${C.subtle};opacity:0.8;">${esc(reason)}</div>` : ''}
        </td>
      </tr>`;
    })
    .join('');
}

/**
 * Render the complete outdoor outlook table.
 */
function renderOutdoorOutlookTable(
  rows: OutdoorOutlookModel['rows'],
  caption: string,
): string {
  const hourRows = renderOutdoorOutlookRows(rows);

  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    <caption style="font-size:0;line-height:0;visibility:hidden;caption-side:top;">${caption}</caption>
    <thead>
      <tr>
        <th scope="col" align="left" style="padding:6px 8px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Time</th>
        <th scope="col" align="center" style="padding:6px 4px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Sky</th>
        <th scope="col" align="left" style="padding:6px 6px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Temp</th>
        <th scope="col" align="left" style="padding:6px 6px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Rain</th>
        <th scope="col" align="left" style="padding:6px 6px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Wind</th>
        <th scope="col" align="left" style="padding:6px 8px 6px 6px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Outdoor</th>
        <th scope="col" align="left" style="padding:6px 8px 6px 2px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Why</th>
      </tr>
    </thead>
    <tbody>${hourRows}</tbody>
  </table>`;
}

/**
 * Update debug context with outdoor comfort data.
 */
function updateDebugContext(
  debugContext: DebugContext | undefined,
  model: OutdoorOutlookModel,
): void {
  if (!debugContext) return;

  const debugHours: DebugOutdoorComfortHour[] = model.dayRows.map(
    ({ hour, score, label }) => ({
      hour: hour.hour,
      comfortScore: score,
      label: label.text,
      tmp: hour.tmp,
      pp: hour.pp,
      wind: hour.wind,
      visK: hour.visK,
      pr: hour.pr,
    }),
  );

  debugContext.outdoorComfort = {
    bestWindow: model.bestWindow,
    hours: debugHours,
  };
}

/**
 * Render the next day hourly outlook section.
 *
 * @param tomorrow - Tomorrow's day summary
 * @param debugContext - Optional debug context to populate
 * @param options - Rendering options
 * @returns HTML string for the section
 */
export function renderNextDayHourlyOutlook(
  tomorrow: DaySummary | undefined,
  debugContext: DebugContext | undefined,
  options: Partial<HourlyOutlookSectionOptions> = {},
): string {
  const config: HourlyOutlookSectionOptions = {
    title: 'Tomorrow at a glance',
    caption: 'Tomorrow&apos;s hourly weather outlook',
    summaryContext: 'tomorrow',
    startAtMinutes: null,
    showOvernight: false,
    photoWindows: [],
    ...options,
  };

  const model = buildOutdoorOutlookModel(tomorrow, config);
  if (!model) return '';

  // Update debug context if provided
  updateDebugContext(debugContext, model);

  // Build HTML
  const table = renderOutdoorOutlookTable(model.rows, config.caption);
  const photoWindowsLine = config.photoWindows?.length
    ? `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">Next photo windows: ${esc(formatPhotoWindowList(config.photoWindows))}</div>`
    : '';

  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">${config.title}</div>
    <div style="Margin-top:4px;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(model.summaryLine)}</div>
    ${photoWindowsLine}
    <div style="Margin-top:12px;overflow-x:auto;">${table}</div>
  `);
}

/**
 * Render the remaining today hourly outlook section.
 *
 * @param today - Today's day summary
 * @param runTime - Current runtime context
 * @param photoWindows - Array of photo windows
 * @param debugContext - Optional debug context to populate
 * @returns HTML string for the section
 */
export function renderRemainingTodayOutlook(
  today: DaySummary | undefined,
  runTime: RunTimeContext,
  photoWindows: Window[],
  debugContext?: DebugContext,
): string {
  // Round up to next hour
  const startAtMinutes =
    runTime.nowMinutes % 60 === 0
      ? runTime.nowMinutes
      : runTime.nowMinutes + (60 - (runTime.nowMinutes % 60));

  return renderNextDayHourlyOutlook(today, debugContext, {
    title: `Today from ${minutesToClock(startAtMinutes)}`,
    caption: 'Today&apos;s remaining-hours outlook',
    summaryContext: 'today',
    startAtMinutes,
    showOvernight: false,
    photoWindows,
  });
}
