import { esc } from '../../../lib/utils.js';
import { bestDaySessionLabel } from '../../shared/window-helpers.js';
import type { AltLocation } from '../../../contracts/index.js';
import { sCard, sChip, sScorePill } from './shared.js';
import { scoreState, C } from '../../shared/brief-primitives.js';

function sLocationItem(loc: AltLocation, isLast: boolean, noteOverride?: string): string {
  const note = noteOverride ?? (loc.isAstroWin
    ? `Astro${loc.darkSky ? ' — dark sky' : ''} — best ${loc.bestAstroHour || 'evening'} — ${loc.driveMins} min drive`
    : `${bestDaySessionLabel(loc.bestDayHour)} — best ${loc.bestDayHour || 'time TBD'} — ${loc.driveMins} min drive`);
  const elevationChip = loc.isUpland && loc.elevationM
    ? sChip('Elev', `${loc.elevationM}m`, C.secondary)
    : '';
  const snowParts: string[] = [];
  if (loc.snowDepthCm) snowParts.push(`${loc.snowDepthCm}cm on ground`);
  if (loc.snowfallCm) snowParts.push(`${loc.snowfallCm}cm expected`);
  const snowLine = snowParts.length
    ? `<div class="card-body" style="margin-top:4px;color:var(--c-secondary);">&#x2745; ${esc(snowParts.join(' · '))}</div>`
    : '';

  return `<div class="${isLast ? '' : 'location-item'}">
    <div class="location-name">${esc(loc.name)}</div>
    <div style="margin-top:6px;">${sScorePill(loc.bestScore)}</div>
    <div class="chip-row" style="margin-top:8px;">
      ${sChip('AM',    loc.amScore    ?? 0, scoreState(loc.amScore    ?? 0).fg)}
      ${sChip('PM',    loc.pmScore    ?? 0, scoreState(loc.pmScore    ?? 0).fg)}
      ${sChip('Astro', loc.astroScore ?? 0, scoreState(loc.astroScore ?? 0).fg)}
      ${elevationChip}
    </div>
    <p class="location-note">${esc(note)}</p>
    ${snowLine}
  </div>`;
}

export interface AlternativeSectionInput {
  altLocations: AltLocation[] | undefined;
  closeContenders: AltLocation[] | undefined;
  noAltsMsg: string | undefined;
}

export function sAlternativeSection(input: AlternativeSectionInput): string {
  const { altLocations, closeContenders, noAltsMsg } = input;

  if ((!altLocations || !altLocations.length) && (!closeContenders || !closeContenders.length)) {
    return sCard(`<p class="card-body">${esc(noAltsMsg || 'No nearby locations score well enough today.')}</p>`);
  }

  const astroAlts = (altLocations || []).filter(loc => loc.isAstroWin);
  const dayAlts   = (altLocations || []).filter(loc => !loc.isAstroWin);
  const contenders = closeContenders || [];
  const sections: string[] = [];

  if (astroAlts.length) {
    sections.push(`<div>
      <div class="card-overline" style="margin-bottom:10px;">Nearby astro options</div>
      ${astroAlts.map((loc, i) => sLocationItem(loc, i === astroAlts.length - 1)).join('')}
    </div>`);
  }

  if (dayAlts.length) {
    sections.push(`<div${astroAlts.length ? ' style="margin-top:14px;"' : ''}>
      <div class="card-overline" style="margin-bottom:10px;">Nearby landscape options</div>
      ${dayAlts.map((loc, i) => sLocationItem(loc, i === dayAlts.length - 1)).join('')}
    </div>`);
  }

  if (contenders.length) {
    sections.push(`<div style="margin-top:14px;">
      <div class="card-overline" style="margin-bottom:8px;">Worth a look for darker skies</div>
      <p class="card-body" style="margin-bottom:10px;">These do not clear the main trip threshold, but darker skies still make them worth a second look.</p>
      ${contenders.map((loc, i) => {
        const bortle = typeof loc.siteDarkness?.bortle === 'number' ? ` · B${loc.siteDarkness.bortle}` : '';
        return sLocationItem(
          loc,
          i === contenders.length - 1,
          `Darker-sky near miss — astro best ${loc.bestAstroHour || 'evening'} — ${loc.driveMins} min drive${bortle}`,
        );
      }).join('')}
    </div>`);
  }

  return sCard(sections.join(''));
}
