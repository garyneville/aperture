import { esc } from '../../../lib/utils.js';
import { clockToMinutes, minutesToClock } from '../../email/time-aware.js';
import type { RunTimeContext, CarWash } from '../../../types/brief.js';
import { C, UTILITY_GLYPHS } from '../../shared/brief-primitives.js';
import { sPill, sChip } from './shared.js';

export interface DaylightUtilityInput {
  todayCarWash: CarWash;
  runTime: RunTimeContext;
}

export function sDaylightUtilityBar(input: DaylightUtilityInput): string {
  const { todayCarWash, runTime } = input;
  const startMinutes = clockToMinutes(todayCarWash.start);
  const endMinutes = clockToMinutes(todayCarWash.end);
  const isPast = startMinutes !== null && endMinutes !== null && endMinutes < runTime.nowMinutes;
  if (isPast) return '';

  const state = todayCarWash.score >= 75
    ? { fg: C.success,              bg: C.successContainer,  border: '#A3D9B1' }
    : todayCarWash.score >= 50
      ? { fg: C.onPrimaryContainer, bg: C.primaryContainer,  border: '#A8D4FB' }
      : { fg: C.error,              bg: C.errorContainer,    border: '#ECACA5' };

  const isOngoing = startMinutes !== null && endMinutes !== null
    && startMinutes <= runTime.nowMinutes && endMinutes >= runTime.nowMinutes;
  const clippedStart = isOngoing
    ? minutesToClock(runTime.nowMinutes % 60 === 0 ? runTime.nowMinutes : runTime.nowMinutes + (60 - (runTime.nowMinutes % 60)))
    : todayCarWash.start;
  const windowStr = todayCarWash.start !== '\u2014' ? `${clippedStart}\u2013${todayCarWash.end}` : '\u2014';
  const utilityLabel = isOngoing ? 'Daylight utility now' : 'Daylight utility';

  return `<div class="card card--surface-variant">
    <div class="utility-bar">
      <div class="utility-bar-left">
        <span class="utility-label">${utilityLabel}</span>
        <span class="utility-window">${UTILITY_GLYPHS} ${esc(windowStr)}</span>
      </div>
      <div>${sPill(`${todayCarWash.rating} ${todayCarWash.label}`, state.fg, state.bg, state.border)}</div>
    </div>
    <div class="chip-row" style="margin-top:8px;">
      ${sChip('Wind', `${todayCarWash.wind}km/h`, C.tertiary)}
      ${sChip('Rain', `${todayCarWash.pp}%`, C.error)}
      ${sChip('Temp', `${todayCarWash.tmp ?? '—'}\u00b0C`, C.secondary)}
    </div>
  </div>`;
}
