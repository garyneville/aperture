import { esc } from '../../../lib/utils.js';
import {
  C,
  FONT,
  card,
  listRows,
  metricChip,
  pill,
  scorePill,
  scoreState,
} from '../shared.js';
import { clockToMinutes, displayTag } from '../time-aware.js';
import type { LongRangeCard, DarkSkyAlertCard, RunTimeContext } from '../types.js';

function displayLongRangeLabel(cardLabel: string | null | undefined): string | null {
  if (!cardLabel) return null;
  return cardLabel === 'Weekend opportunity' ? 'Long-range opportunity' : cardLabel;
}

function departByTime(targetTime: string | null | undefined, driveMins: number): string | null {
  if (!targetTime || !/^\d{2}:\d{2}$/.test(targetTime)) return null;
  const [hours, minutes] = targetTime.split(':').map(Number);
  const targetMinutes = (hours * 60) + minutes;
  const departMinutes = ((targetMinutes - driveMins) % (24 * 60) + (24 * 60)) % (24 * 60);
  const departHours = Math.floor(departMinutes / 60);
  const departMins = departMinutes % 60;
  return `${String(departHours).padStart(2, '0')}:${String(departMins).padStart(2, '0')}`;
}

function longRangeFeasibilityNote(longRangeTop: LongRangeCard, runTime: RunTimeContext): { note: string; suppress: boolean } {
  const targetTime = longRangeTop.isAstroWin ? longRangeTop.bestAstroHour : longRangeTop.bestDayHour;
  const departBy = departByTime(targetTime, longRangeTop.driveMins);
  const windowType = longRangeTop.isAstroWin ? 'astro window' : 'light window';

  if (departBy && targetTime) {
    const departByMinutes = clockToMinutes(departBy);
    if (departByMinutes !== null) {
      const minutesUntilDeparture = departByMinutes - runTime.nowMinutes;
      if (minutesUntilDeparture < 0) {
        return { note: '', suppress: true };
      }
      if (minutesUntilDeparture < 60) {
        return {
          note: `Departure window closing - leave by ~${departBy} for the ${targetTime} ${windowType}.`,
          suppress: false,
        };
      }
      if (minutesUntilDeparture <= 180) {
        return {
          note: `Departing soon - leave by ~${departBy} for the ${targetTime} ${windowType}.`,
          suppress: false,
        };
      }
    }
  }

  if (longRangeTop.driveMins >= 180) {
    if (departBy && targetTime) {
      return {
        note: `Road-trip option - leave by ~${departBy} for the ${targetTime} ${windowType}. Overnight recommended.`,
        suppress: false,
      };
    }
    return {
      note: 'Road-trip option - best treated as a dedicated trip rather than a same-day short-notice run.',
      suppress: false,
    };
  }
  if (longRangeTop.driveMins >= 120) {
    if (departBy && targetTime) {
      return {
        note: `Long drive - leave by ~${departBy} for the ${targetTime} ${windowType}.`,
        suppress: false,
      };
    }
    return {
      note: 'Long drive - better as a planned outing than a casual detour.',
      suppress: false,
    };
  }
  if (longRangeTop.driveMins >= 90) {
    return {
      note: 'Long drive - better as a planned outing than a casual detour.',
      suppress: false,
    };
  }
  return { note: '', suppress: false };
}

export function longRangeSection(
  longRangeTop: LongRangeCard | null | undefined,
  cardLabel: string | null | undefined,
  darkSkyAlert: DarkSkyAlertCard | null | undefined,
  runTime: RunTimeContext,
): string {
  const cards: string[] = [];
  const feasibility = longRangeTop ? longRangeFeasibilityNote(longRangeTop, runTime) : { note: '', suppress: false };

  if (longRangeTop && cardLabel && !feasibility.suppress) {
    const displayLabel = displayLongRangeLabel(cardLabel) || cardLabel;
    const regionLabel = longRangeTop.region.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    const timing = longRangeTop.isAstroWin
      ? `Best astro around ${longRangeTop.bestAstroHour || 'evening'}${longRangeTop.darkSky ? ' - dark sky site' : ''}`
      : `Best at ${longRangeTop.bestDayHour || 'time TBD'} - ${longRangeTop.tags.slice(0, 2).map(tag => displayTag(tag)).join(', ')}`;
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">${esc(displayLabel)}</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:600;line-height:1.24;letter-spacing:-0.01em;color:${C.ink};">${esc(longRangeTop.name)}</div>
      <div style="Margin-top:4px;font-family:${FONT};font-size:14px;line-height:1.4;color:${C.muted};">${esc(regionLabel)} &middot; ${longRangeTop.elevation}m &middot; ${longRangeTop.driveMins} min drive</div>
      <div style="Margin-top:10px;">${scorePill(longRangeTop.bestScore, longRangeTop.isAstroWin ? 'astro' : undefined)}</div>
      <div style="Margin-top:8px;">
        ${metricChip('AM', longRangeTop.amScore ?? 0, scoreState(longRangeTop.amScore ?? 0).fg)}
        ${metricChip('PM', longRangeTop.pmScore ?? 0, scoreState(longRangeTop.pmScore ?? 0).fg)}
        ${metricChip('Astro', longRangeTop.astroScore ?? 0, scoreState(longRangeTop.astroScore ?? 0).fg)}
      </div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(timing)}</div>
      ${feasibility.note ? `<div style="Margin-top:8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.secondary};">${esc(feasibility.note)}</div>` : ''}
    `, '', `border-top:3px solid ${C.secondary};`));
  }

  if (darkSkyAlert && (!longRangeTop || darkSkyAlert.name !== longRangeTop.name)) {
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Dark sky alert</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">${esc(darkSkyAlert.name)}</div>
      <div style="Margin-top:10px;">${pill(`Astro ${darkSkyAlert.astroScore}/100`, C.success, C.successContainer, '#A3D9B1')}</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">
        Perfect conditions tonight from ${esc(darkSkyAlert.bestAstroHour || 'nightfall')} &middot; ${darkSkyAlert.driveMins} min drive
      </div>
    `));
  }

  return listRows(cards);
}
