import { esc } from '../../../lib/utils.js';
import { displayTag } from '../../email/time-aware.js';
import type { SpurOfTheMomentSuggestion } from '../../../types/brief.js';
import { sCard, sChip } from './shared.js';
import { C } from '../../shared/brief-primitives.js';

export interface SpurOfMomentInput {
  spur: SpurOfTheMomentSuggestion;
}

export function sSpurCard(input: SpurOfMomentInput): string {
  const { spur } = input;
  const regionLabel = spur.region.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const tagChips = spur.tags.slice(0, 3).map(tag => sChip(displayTag(tag), '')).join('');
  const darkSkyNote = spur.darkSky
    ? `<span style="font-size:12px;color:${C.secondary};">&#x2605; Dark sky site</span>`
    : '';
  return sCard(`
    <div style="font-size:14px;font-weight:600;color:var(--c-ink);margin-bottom:6px;">${esc(spur.locationName)}</div>
    <p class="card-body" style="margin-bottom:10px;">${esc(regionLabel)} &middot; ${spur.driveMins} min drive</p>
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:var(--c-ink);font-style:italic;">${esc(spur.hookLine)}</p>
    ${tagChips || darkSkyNote ? `<div class="chip-row" style="margin-top:10px;">${tagChips}${darkSkyNote}</div>` : ''}
  `, { accentSide: 'left', accentColor: C.brand });
}
