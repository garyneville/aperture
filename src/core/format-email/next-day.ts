import { esc } from '../utils.js';
import type { DebugContext, DebugOutdoorComfortHour } from '../debug-context.js';
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
  weatherIconForHour,
} from './shared.js';
import {
  bestDaySessionLabel,
  clockToMinutes,
  forecastBestLine,
  minutesToClock,
  windowRange,
} from './time-aware.js';
import type { CarWash, DaySummary, NextDayHour, RunTimeContext, Window } from './types.js';

export function outdoorComfortScore(h: Pick<NextDayHour, 'tmp' | 'pp' | 'wind' | 'visK' | 'pr'>): number {
  let score = 100;

  if (h.pp > 70) score -= 50;
  else if (h.pp > 40) score -= 30;
  else if (h.pp > 20) score -= 15;
  else if (h.pp > 5) score -= 5;

  if (h.wind > 45) score -= 45;
  else if (h.wind > 30) score -= 30;
  else if (h.wind > 20) score -= 15;
  else if (h.wind > 12) score -= 5;

  if (h.tmp < 0) score -= 35;
  else if (h.tmp < 4) score -= 20;
  else if (h.tmp < 7) score -= 10;
  else if (h.tmp > 32) score -= 15;
  else if (h.tmp > 27) score -= 5;

  if (h.visK < 0.5) score -= 40;
  else if (h.visK < 2) score -= 25;
  else if (h.visK < 5) score -= 10;

  if (h.pr > 3) score -= 30;
  else if (h.pr > 1) score -= 20;
  else if (h.pr > 0.2) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function outdoorComfortLabel(
  score: number,
  h: Pick<NextDayHour, 'wind' | 'tmp' | 'pp'>,
): { text: string; fg: string; bg: string; highlight: boolean } {
  const maxRunWindKmh = 22;
  const minRunTempC = 4;
  const maxRunTempC = 25;
  const maxRunRainPct = 40;
  if (score >= 75) {
    const runFriendly = h.wind <= maxRunWindKmh && h.tmp >= minRunTempC && h.tmp <= maxRunTempC && h.pp < maxRunRainPct;
    return {
      text: runFriendly ? 'Best for a run' : 'Best for a walk',
      fg: C.success,
      bg: C.successContainer,
      highlight: true,
    };
  }
  if (score >= 55) return { text: 'Pleasant', fg: C.secondary, bg: C.secondaryContainer, highlight: true };
  if (score >= 35) return { text: 'Acceptable', fg: C.muted, bg: C.surfaceVariant, highlight: false };
  return { text: 'Poor conditions', fg: C.error, bg: C.errorContainer, highlight: false };
}

export function outdoorComfortReason(h: Pick<NextDayHour, 'tmp' | 'pp' | 'wind' | 'visK' | 'pr'>): string {
  const reasons: string[] = [];
  if (h.pr > 1 || h.pp >= 60) reasons.push('rain-heavy');
  else if (h.pr > 0.2 || h.pp >= 35) reasons.push('rain risk');

  if (h.wind >= 35) reasons.push('strong wind');
  else if (h.wind >= 22) reasons.push('breezy');

  if (h.tmp < 3) reasons.push('cold');
  else if (h.tmp > 28) reasons.push('warm');

  if (h.visK < 2) reasons.push('low visibility');

  if (!reasons.length) return '';
  return reasons.slice(0, 2).join(', ');
}

export interface OutdoorOutlookRow {
  hour: NextDayHour;
  score: number;
  label: ReturnType<typeof outdoorComfortLabel>;
  reason: string;
}

export interface OutdoorOutlookOptions {
  summaryContext: 'today' | 'tomorrow';
  startAtMinutes?: number | null;
  showOvernight?: boolean;
  photoWindows?: Window[];
}

export interface OutdoorOutlookModel {
  hours: NextDayHour[];
  rows: OutdoorOutlookRow[];
  dayRows: OutdoorOutlookRow[];
  bestWindow: { start: string; end: string; label: string } | null;
  summaryLine: string;
}

interface HourlyOutlookSectionOptions extends OutdoorOutlookOptions {
  title: string;
  caption: string;
}

function outdoorSummaryLine(
  bestWindow: { start: string; end: string; label: string } | null,
  hours: NextDayHour[],
  summaryContext: 'today' | 'tomorrow',
): string {
  if (!hours.length) return summaryContext === 'today'
    ? 'No useful outdoor hours remain today.'
    : 'No forecast data available for tomorrow.';
  const dayHours = hours.filter(hour => !hour.isNight);
  if (!dayHours.length) return summaryContext === 'today'
    ? 'No daytime outdoor hours remain today.'
    : 'No daytime hours in tomorrow\'s forecast.';

  const avgTmp = Math.round(dayHours.reduce((sum, hour) => sum + hour.tmp, 0) / dayHours.length);
  const maxPp = Math.max(...dayHours.map(hour => hour.pp));
  const maxWind = Math.max(...dayHours.map(hour => hour.wind));
  const rainNote = maxPp > 60 ? 'heavy rain likely' : maxPp > 30 ? 'some rain likely' : maxPp > 10 ? 'chance of showers' : 'mostly dry';
  const windNote = maxWind > 40 ? ' with strong winds' : maxWind > 25 ? ' with breezy spells' : '';
  const capitalizedRain = rainNote.charAt(0).toUpperCase() + rainNote.slice(1);

  if (bestWindow) {
    return summaryContext === 'today'
      ? `${capitalizedRain}${windNote}. Around ${avgTmp}°C. Best remaining outdoor window: ${bestWindow.start}–${bestWindow.end}.`
      : `${capitalizedRain}${windNote}. Around ${avgTmp}°C. Best outdoor window: ${bestWindow.start}–${bestWindow.end}.`;
  }
  return `${capitalizedRain}${windNote}. Around ${avgTmp}°C. Limited outdoor opportunities.`;
}

function hourFallsWithinPhotoWindow(hour: string, window: Window): boolean {
  const hourMinutes = clockToMinutes(hour);
  const startMinutes = clockToMinutes(window.start);
  const endMinutes = clockToMinutes(window.end);
  if (hourMinutes === null || startMinutes === null || endMinutes === null) return false;
  if (endMinutes < startMinutes) {
    return hourMinutes >= startMinutes || hourMinutes <= endMinutes;
  }
  return hourMinutes >= startMinutes && hourMinutes <= endMinutes;
}

function shouldDisplayOutdoorHour(hour: NextDayHour, showOvernight: boolean, photoWindows: Window[] = []): boolean {
  if (showOvernight) return true;
  if (photoWindows.some(window => hourFallsWithinPhotoWindow(hour.hour, window))) return true;
  const minutes = clockToMinutes(hour.hour) ?? 0;
  return !hour.isNight || (minutes >= 18 * 60 && minutes < 23 * 60);
}

function formatPhotoWindowList(windows: Window[]): string {
  return windows.map(window => `${window.label} ${windowRange(window)}`).join(' · ');
}

function findContiguousRuns<T>(items: T[], predicate: (item: T) => boolean): Array<{ start: number; end: number }> {
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

function bestOutdoorWindow(rows: OutdoorOutlookRow[]): { start: string; end: string; label: string } | null {
  const highlightedRows = rows.filter(row => row.label.highlight);
  if (!highlightedRows.length) return null;

  const peakScore = Math.max(...highlightedRows.map(row => row.score));
  const focusedThreshold = Math.max(55, peakScore - 10);
  const focusedRuns = findContiguousRuns(rows, row => row.label.highlight && row.score >= focusedThreshold);
  const fallbackRuns = findContiguousRuns(rows, row => row.label.highlight);
  const candidateRuns = focusedRuns.length ? focusedRuns : fallbackRuns;

  if (!candidateRuns.length) return null;

  const [bestRun] = candidateRuns
    .map(run => {
      const runRows = rows.slice(run.start, run.end + 1);
      const peak = Math.max(...runRows.map(row => row.score));
      const average = runRows.reduce((sum, row) => sum + row.score, 0) / runRows.length;
      return { ...run, peak, average, length: runRows.length };
    })
    .sort((left, right) => (
      right.peak - left.peak
      || right.average - left.average
      || right.length - left.length
      || left.start - right.start
    ));

  const runRows = rows.slice(bestRun.start, bestRun.end + 1);
  const topRow = runRows.reduce((best, row) => row.score > best.score ? row : best);
  return {
    start: rows[bestRun.start].hour.hour,
    end: rows[bestRun.end].hour.hour,
    label: topRow.label.text,
  };
}

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
  const hours = (day?.hours || [])
    .filter(hour => config.startAtMinutes === null || config.startAtMinutes === undefined || (clockToMinutes(hour.hour) ?? -1) >= config.startAtMinutes)
    .filter(hour => shouldDisplayOutdoorHour(hour, Boolean(config.showOvernight), config.photoWindows || []));

  if (!hours.length) return null;

  const rows = hours.map(hour => {
    const score = outdoorComfortScore(hour);
    const label = outdoorComfortLabel(score, hour);
    const reason = outdoorComfortReason(hour);
    return { hour, score, label, reason };
  });
  const dayRows = rows.filter(({ hour }) => !hour.isNight);
  const bestWindow = bestOutdoorWindow(dayRows);

  return {
    hours,
    rows,
    dayRows,
    bestWindow,
    summaryLine: outdoorSummaryLine(bestWindow, hours, config.summaryContext),
  };
}

export function nextDayHourlyOutlookSection(
  tomorrow: DaySummary | undefined,
  debugContext?: DebugContext,
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

  if (debugContext) {
    const debugHours: DebugOutdoorComfortHour[] = model.dayRows
      .map(({ hour, score, label }) => ({
        hour: hour.hour,
        comfortScore: score,
        label: label.text,
        tmp: hour.tmp,
        pp: hour.pp,
        wind: hour.wind,
        visK: hour.visK,
        pr: hour.pr,
      }));
    debugContext.outdoorComfort = { bestWindow: model.bestWindow, hours: debugHours };
  }

  const hourRows = model.rows.map(({ hour, score, label, reason }) => {
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
  }).join('');

  const table = `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    <caption style="font-size:0;line-height:0;visibility:hidden;caption-side:top;">${config.caption}</caption>
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

export function remainingTodayHourlyOutlookSection(
  today: DaySummary | undefined,
  runTime: RunTimeContext,
  photoWindows: Window[],
  debugContext?: DebugContext,
): string {
  const startAtMinutes = runTime.nowMinutes % 60 === 0
    ? runTime.nowMinutes
    : runTime.nowMinutes + (60 - (runTime.nowMinutes % 60));
  return nextDayHourlyOutlookSection(today, debugContext, {
    title: `Today from ${minutesToClock(startAtMinutes)}`,
    caption: 'Today&apos;s remaining-hours outlook',
    summaryContext: 'today',
    startAtMinutes,
    showOvernight: false,
    photoWindows,
  });
}

function forecastMoonPct(day: DaySummary): number | null {
  const hours = day.hours || [];
  const bestAstroHour = day.bestAstroHour
    ? hours.find(hour => hour.hour === day.bestAstroHour && typeof hour.moon === 'number')
    : null;
  const representativeHour = bestAstroHour
    || hours.find(hour => hour.isNight && typeof hour.moon === 'number')
    || hours.find(hour => typeof hour.moon === 'number')
    || null;
  return typeof representativeHour?.moon === 'number' ? Math.round(representativeHour.moon) : null;
}

export function photoForecastCards(dailySummary: DaySummary[]): string {
  const forecastDays = dailySummary.filter(day => day.dayIdx >= 1).slice(0, 4);
  return forecastDays.map(day => {
    const dayIsAstroLed = (day.astroScore ?? 0) > (day.photoScore ?? 0);
    const { confidence: effectiveConfidence } = effectiveConf(day, dayIsAstroLed);
    const displayScore = day.headlineScore ?? day.photoScore;
    const bestAltHour = day.bestAlt?.isAstroWin
      ? day.bestAlt.bestAstroHour
      : day.bestAlt?.bestDayHour;
    const scoreStr = typeof displayScore === 'number' ? `${displayScore}/100` : '-';
    const confState = confidenceDetail(effectiveConfidence);
    const moonPct = forecastMoonPct(day);
    const moonLine = moonPct !== null
      ? `${moonIconForPct(moonPct, 12)} <span style="vertical-align:middle;">Moon ${moonPct}% lit</span>`
      : '';
    const spreadNote = dayIsAstroLed
      ? (day.astroConfidenceStdDev !== null && day.astroConfidenceStdDev !== undefined ? ` · spread ${day.astroConfidenceStdDev}` : '')
      : (day.confidenceStdDev !== null && day.confidenceStdDev !== undefined ? ` · spread ${day.confidenceStdDev}` : '');
    const confText = confState ? `<span style="color:${confState.fg};">${confState.label}${spreadNote}</span>` : '';
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
  }).join('<div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>');
}

export function daylightUtilityTodayCard(todayCarWash: CarWash, runTime: RunTimeContext): string {
  const startMinutes = clockToMinutes(todayCarWash.start);
  const endMinutes = clockToMinutes(todayCarWash.end);
  const isPast = startMinutes !== null && endMinutes !== null && endMinutes < runTime.nowMinutes;
  if (isPast) return '';

  const state = todayCarWash.score >= 75
    ? { fg: C.success, bg: C.successContainer, border: '#A3D9B1' }
    : todayCarWash.score >= 50
      ? { fg: C.onPrimaryContainer, bg: C.primaryContainer, border: '#A8D4FB' }
      : { fg: C.error, bg: C.errorContainer, border: '#ECACA5' };
  const isOngoing = startMinutes !== null && endMinutes !== null && startMinutes <= runTime.nowMinutes && endMinutes >= runTime.nowMinutes;
  const clippedStart = isOngoing
    ? minutesToClock(runTime.nowMinutes % 60 === 0 ? runTime.nowMinutes : runTime.nowMinutes + (60 - (runTime.nowMinutes % 60)))
    : todayCarWash.start;
  const window = todayCarWash.start !== '\u2014'
    ? `${clippedStart}–${todayCarWash.end}`
    : '\u2014';
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
