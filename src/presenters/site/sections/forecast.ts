import { esc } from '../../../lib/utils.js';
import { dayHeading, effectiveConf, moonIconForPct, confidenceDetail } from '../../shared/brief-primitives.js';
import { forecastBestLine } from '../../shared/window-helpers.js';
import type { DaySummary } from '../../../contracts/index.js';
import { sCard, sChip } from './shared.js';
import { scoreState, C } from '../../shared/brief-primitives.js';

function sForecastMoonPct(day: DaySummary): number | null {
  const hours = day.hours || [];
  const bestAstroHour = day.bestAstroHour
    ? hours.find(h => h.hour === day.bestAstroHour && typeof h.moon === 'number')
    : null;
  const representative = bestAstroHour
    || hours.find(h => h.isNight && typeof h.moon === 'number')
    || hours.find(h => typeof h.moon === 'number')
    || null;
  return typeof representative?.moon === 'number' ? Math.round(representative.moon) : null;
}

export function sPhotoForecastCards(dailySummary: DaySummary[]): string {
  const days = dailySummary.filter(d => d.dayIdx >= 1).slice(0, 4);
  return `<div class="section-stack">${days.map(day => {
    const dayIsAstroLed = (day.astroScore ?? 0) > (day.photoScore ?? 0);
    const { confidence: effConf } = effectiveConf(day, dayIsAstroLed);
    const displayScore = day.headlineScore ?? day.photoScore;
    const confState = confidenceDetail(effConf);
    const moonPct = sForecastMoonPct(day);
    const spreadNote = dayIsAstroLed
      ? (day.astroConfidenceStdDev != null ? ` · spread ${day.astroConfidenceStdDev}` : '')
      : (day.confidenceStdDev != null ? ` · spread ${day.confidenceStdDev}` : '');
    const bestAltHour = day.bestAlt?.isAstroWin ? day.bestAlt.bestAstroHour : day.bestAlt?.bestDayHour;
    const altLine = day.bestAlt
      ? `Backup: ${day.bestAlt.name} · ${day.bestAlt.bestScore}/100${bestAltHour ? ` at ${bestAltHour}` : ''}${day.bestAlt.isAstroWin ? ' (astro)' : ''}${typeof day.bestAlt.driveMins === 'number' ? ` · ${day.bestAlt.driveMins} min drive` : ''}`
      : '';

    return sCard(`
      <div class="forecast-day-heading">${esc(dayHeading(day))} &middot; ${scoreState(displayScore).label} (${displayScore}/100)</div>
      <div class="forecast-best-line">${esc(forecastBestLine(day))}</div>
      <div class="chip-row">
        ${sChip('AM',    day.amScore    ?? 0, scoreState(day.amScore    ?? 0).fg)}
        ${sChip('PM',    day.pmScore    ?? 0, scoreState(day.pmScore    ?? 0).fg)}
        ${sChip('Astro', day.astroScore ?? 0, scoreState(day.astroScore ?? 0).fg)}
        ${confState ? `<span style="font-size:11px;font-weight:600;color:${confState.fg};">${esc(confState.label)}${esc(spreadNote)}</span>` : ''}
      </div>
      ${moonPct !== null ? `<p class="card-body" style="margin-top:8px;color:${C.secondary};">${moonIconForPct(moonPct, 12)} <span style="vertical-align:middle;">Moon ${moonPct}% lit</span></p>` : ''}
      ${altLine ? `<p class="card-body" style="margin-top:8px;">${esc(altLine)}</p>` : ''}
    `);
  }).join('')}</div>`;
}
