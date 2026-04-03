import { esc } from '../../../lib/utils.js';
import {
  C,
  FONT,
  card,
  metricChip,
  scorePill,
  scoreState,
} from '../shared.js';
import { bestDaySessionLabel, displayTag } from '../../shared/window-helpers.js';
import type { AltLocation } from '../types.js';

function buildSnowNote(snowDepthCm: number | null, snowfallCm: number | null): string {
  const parts: string[] = [];
  if (snowDepthCm !== null && snowDepthCm > 0) parts.push(`${snowDepthCm}cm snow on the ground`);
  if (snowfallCm !== null && snowfallCm > 0) parts.push(`${snowfallCm}cm snowfall expected`);
  return parts.join(' · ');
}

function renderGroup(title: string, locations: AltLocation[]): string {
  if (!locations.length) return '';
  const rows = locations.map((loc, index) => {
    const note = loc.isAstroWin
      ? `Astro${loc.darkSky ? ' - dark sky' : ''} - best ${loc.bestAstroHour || 'evening'} - ${loc.driveMins} min drive`
      : `${bestDaySessionLabel(loc.bestDayHour)} - best ${loc.bestDayHour || 'time TBD'} - ${loc.driveMins} min drive`;
    const elevationChip = loc.isUpland && loc.elevationM
      ? metricChip('Elev', `${loc.elevationM}m`, C.secondary)
      : '';
    const snowNote = buildSnowNote(loc.snowDepthCm ?? null, loc.snowfallCm ?? null);
    return `<div style="${index < locations.length - 1 ? `padding:0 0 10px;border-bottom:1px solid ${C.outline};margin-bottom:10px;` : ''}">
      <div style="font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">${esc(loc.name)}</div>
      <div style="Margin-top:8px;">${scorePill(loc.bestScore)}</div>
      <div style="Margin-top:8px;">
        ${metricChip('AM', loc.amScore ?? 0, scoreState(loc.amScore ?? 0).fg)}
        ${metricChip('PM', loc.pmScore ?? 0, scoreState(loc.pmScore ?? 0).fg)}
        ${metricChip('Astro', loc.astroScore ?? 0, scoreState(loc.astroScore ?? 0).fg)}
        ${elevationChip}
      </div>
      <div style="Margin-top:8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(note)}</div>
      ${snowNote ? `<div style="Margin-top:4px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.secondary};"><span role="img" aria-label="snow">❄</span> ${esc(snowNote)}</div>` : ''}
    </div>`;
  }).join('');

  return `
    <div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};Margin:0 0 10px;">${esc(title)}</div>
    ${rows}
  `;
}

function renderCloseContenders(locations: AltLocation[]): string {
  if (!locations.length) return '';
  const rows = locations.map((loc, index) => {
    const bortle = typeof loc.siteDarkness?.bortle === 'number' ? ` · B${loc.siteDarkness.bortle}` : '';
    return `<div style="${index < locations.length - 1 ? `padding:0 0 10px;border-bottom:1px solid ${C.outline};margin-bottom:10px;` : ''}">
      <div style="font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">${esc(loc.name)}</div>
      <div style="Margin-top:8px;">${scorePill(loc.bestScore)}</div>
      <div style="Margin-top:8px;">
        ${metricChip('AM', loc.amScore ?? 0, scoreState(loc.amScore ?? 0).fg)}
        ${metricChip('PM', loc.pmScore ?? 0, scoreState(loc.pmScore ?? 0).fg)}
        ${metricChip('Astro', loc.astroScore ?? 0, scoreState(loc.astroScore ?? 0).fg)}
      </div>
      <div style="Margin-top:8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(`Darker-sky near miss - astro best ${loc.bestAstroHour || 'evening'} - ${loc.driveMins} min drive${bortle}`)}</div>
    </div>`;
  }).join('');

  return `
    <div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};Margin:0 0 10px;">Worth a look for darker skies</div>
    <div style="Margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">These do not clear the main trip threshold, but darker skies still make them worth a second look.</div>
    ${rows}
  `;
}

export function alternativeSection(
  altLocations: AltLocation[] | undefined,
  closeContenders: AltLocation[] | undefined,
  noAltsMsg: string | undefined,
): string {
  if ((!altLocations || !altLocations.length) && (!closeContenders || !closeContenders.length)) {
    return card(`<div style="font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(noAltsMsg || 'No nearby locations score well enough today.')}</div>`);
  }

  const astroAlternatives = (altLocations || []).filter(loc => loc.isAstroWin);
  const goldenHourAlternatives = (altLocations || []).filter(loc => !loc.isAstroWin);
  return card([
    renderGroup('Nearby astro options', astroAlternatives),
    renderGroup('Nearby landscape options', goldenHourAlternatives),
    renderCloseContenders(closeContenders || []),
  ].filter(Boolean).join(`<div style="height:14px;"></div>`));
}

export function alternativeSummaryTitle(topAlternative: AltLocation | null | undefined, isCloseContender = false): string {
  if (!topAlternative) return 'Best nearby alternative';
  if (isCloseContender) return 'Nearby darker-sky contender';
  return topAlternative.isAstroWin ? 'Best nearby astro alternative' : 'Best nearby golden-hour alternative';
}

export function alternativeTimingSummary(topAlternative: AltLocation | null | undefined): string {
  if (!topAlternative) return '';
  if (topAlternative.isAstroWin) return ` · astro from ${topAlternative.bestAstroHour || 'evening'}`;
  return ` · ${bestDaySessionLabel(topAlternative.bestDayHour).toLowerCase()} around ${topAlternative.bestDayHour || 'time TBD'}`;
}

export function spurOfTheMomentCard(spur: { locationName: string; hookLine: string; driveMins: number; region: string; tags: string[]; darkSky?: boolean }): string {
  const regionLabel = spur.region.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  const tagChips = spur.tags.slice(0, 3).map(tag => metricChip(displayTag(tag), '')).join('');
  const darkSkyNote = spur.darkSky
    ? `<span style="font-family:${FONT};font-size:12px;color:${C.secondary};"><span role="img" aria-label="dark sky site">&#x2605;</span> Dark sky site</span>`
    : '';

  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:14px;font-weight:600;color:${C.ink};">${esc(spur.locationName)}</div>
    <div style="Margin:0 0 10px;font-family:${FONT};font-size:13px;color:${C.muted};">${esc(regionLabel)} &middot; ${spur.driveMins} min drive</div>
    <div style="font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};font-style:italic;">${esc(spur.hookLine)}</div>
    ${tagChips || darkSkyNote ? `<div style="Margin-top:10px;">${tagChips}${darkSkyNote}</div>` : ''}
  `, '', `border-left:3px solid ${C.primary};`);
}
