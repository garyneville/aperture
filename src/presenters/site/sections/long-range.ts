import { esc } from '../../../lib/utils.js';
import { clockToMinutes, minutesToClock } from '../../../domain/windowing/index.js';
import type { DarkSkyAlertCard, LongRangeCard, RunTimeContext } from '../../../contracts/index.js';
import { C } from '../../shared/brief-primitives.js';
import { sCard, sChip, sScorePill, sPill } from './shared.js';
import { scoreState } from '../../shared/brief-primitives.js';
import { displayTag } from '../../shared/window-helpers.js';

function departByTime(targetTime: string | null | undefined, driveMins: number): string | null {
  if (!targetTime || !/^\d{2}:\d{2}$/.test(targetTime)) return null;
  const [hours, mins] = targetTime.split(':').map(Number);
  const targetMinutes = (hours * 60) + mins;
  const departMinutes = ((targetMinutes - driveMins) % (24 * 60) + (24 * 60)) % (24 * 60);
  const dh = Math.floor(departMinutes / 60);
  const dm = departMinutes % 60;
  return `${String(dh).padStart(2, '0')}:${String(dm).padStart(2, '0')}`;
}

function longRangeFeasibilityNote(top: LongRangeCard, runTime: RunTimeContext): { note: string; suppress: boolean } {
  const targetTime = top.isAstroWin ? top.bestAstroHour : top.bestDayHour;
  const departBy = departByTime(targetTime, top.driveMins);
  const windowType = top.isAstroWin ? 'astro window' : 'light window';
  if (departBy && targetTime) {
    const departByMinutes = clockToMinutes(departBy);
    if (departByMinutes !== null) {
      const minutesUntilDeparture = departByMinutes - runTime.nowMinutes;
      if (minutesUntilDeparture < 0) {
        return { note: '', suppress: true };
      }
      if (minutesUntilDeparture < 60) {
        return {
          note: `Departure window closing — leave by ~${departBy} for the ${targetTime} ${windowType}.`,
          suppress: false,
        };
      }
      if (minutesUntilDeparture <= 180) {
        return {
          note: `Departing soon — leave by ~${departBy} for the ${targetTime} ${windowType}.`,
          suppress: false,
        };
      }
    }
  }
  if (top.driveMins >= 180) {
    return {
      note: departBy && targetTime
        ? `Road-trip option — leave by ~${departBy} for the ${targetTime} ${windowType}. Overnight recommended.`
        : 'Road-trip option — best treated as a dedicated trip rather than a same-day short-notice run.',
      suppress: false,
    };
  }
  if (top.driveMins >= 120) {
    return {
      note: departBy && targetTime
        ? `Long drive — leave by ~${departBy} for the ${targetTime} ${windowType}.`
        : 'Long drive — better as a planned outing than a casual detour.',
      suppress: false,
    };
  }
  if (top.driveMins >= 90) {
    return {
      note: 'Long drive — better as a planned outing than a casual detour.',
      suppress: false,
    };
  }
  return { note: '', suppress: false };
}

export interface LongRangeSectionInput {
  longRangeTop: LongRangeCard | null | undefined;
  cardLabel: string | null | undefined;
  darkSkyAlert: DarkSkyAlertCard | null | undefined;
  runTime: RunTimeContext;
}

export function sLongRangeSection(input: LongRangeSectionInput): string {
  const { longRangeTop, cardLabel, darkSkyAlert, runTime } = input;
  const cards: string[] = [];
  const feasibility = longRangeTop ? longRangeFeasibilityNote(longRangeTop, runTime) : { note: '', suppress: false };

  if (longRangeTop && cardLabel && !feasibility.suppress) {
    const displayLabel = cardLabel === 'Weekend opportunity' ? 'Long-range opportunity' : cardLabel;
    const regionLabel = longRangeTop.region.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const timing = longRangeTop.isAstroWin
      ? `Best astro around ${longRangeTop.bestAstroHour || 'evening'}${longRangeTop.darkSky ? ' — dark sky site' : ''}`
      : `Best at ${longRangeTop.bestDayHour || 'time TBD'} — ${longRangeTop.tags.slice(0, 2).map(displayTag).join(', ')}`;

    cards.push(sCard(`
      <div class="card-overline">${esc(displayLabel)}</div>
      <div class="card-headline card-headline--lg">${esc(longRangeTop.name)}</div>
      <p class="card-body" style="margin-top:4px;">${esc(regionLabel)} &middot; ${longRangeTop.elevation}m &middot; ${longRangeTop.driveMins} min drive</p>
      <div style="margin-top:10px;">${sScorePill(longRangeTop.bestScore, longRangeTop.isAstroWin ? 'astro' : undefined)}</div>
      <div class="chip-row" style="margin-top:8px;">
        ${sChip('AM',    longRangeTop.amScore    ?? 0, scoreState(longRangeTop.amScore    ?? 0).fg)}
        ${sChip('PM',    longRangeTop.pmScore    ?? 0, scoreState(longRangeTop.pmScore    ?? 0).fg)}
        ${sChip('Astro', longRangeTop.astroScore ?? 0, scoreState(longRangeTop.astroScore ?? 0).fg)}
      </div>
      <p class="card-body" style="margin-top:10px;">${esc(timing)}</p>
      ${feasibility.note ? `<p class="card-body" style="margin-top:8px;color:${C.secondary};">${esc(feasibility.note)}</p>` : ''}
    `, { accentSide: 'top', accentColor: C.secondary }));
  }

  if (darkSkyAlert && (!longRangeTop || darkSkyAlert.name !== longRangeTop.name)) {
    cards.push(sCard(`
      <div class="card-overline">Dark sky alert</div>
      <div class="card-headline">${esc(darkSkyAlert.name)}</div>
      <div style="margin-top:10px;">${sPill(`Astro ${darkSkyAlert.astroScore}/100`, C.success, C.successContainer, '#A3D9B1')}</div>
      <p class="card-body" style="margin-top:10px;">
        Perfect conditions tonight from ${esc(darkSkyAlert.bestAstroHour || 'nightfall')} &middot; ${darkSkyAlert.driveMins} min drive
      </p>
    `));
  }

  if (!cards.length) return '';
  return `<div class="section-stack">${cards.join('')}</div>`;
}
