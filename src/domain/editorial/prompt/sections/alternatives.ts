import type { AltLocationResult } from '../build-prompt.js';

export function topAlternativeLine(altLocations?: AltLocationResult[]): string {
  const alt = altLocations?.[0];
  if (!alt) return '';

  const timing = alt.isAstroWin
    ? `best astro at ${alt.bestAstroHour || 'nightfall'}`
    : `best at ${alt.bestDayHour || 'time TBD'}`;

  return `${alt.name} (${alt.driveMins}min, ${alt.bestScore}/100, ${timing}${alt.darkSky ? ', dark sky' : ''})`;
}

function dayAlternativeTiming(bestDayHour: string | null): string {
  if (!bestDayHour) return 'golden hour';
  const hour = Number.parseInt(bestDayHour.slice(0, 2), 10);
  if (!Number.isFinite(hour)) return `best at ${bestDayHour}`;
  return hour < 12 ? `morning golden hour around ${bestDayHour}` : `evening golden hour around ${bestDayHour}`;
}

export function alternativePromptSection(title: string, alts: AltLocationResult[]): string {
  if (!alts.length) return '';
  return `${title}:\n${alts.slice(0, 3).map(l =>
    `- ${l.name} (${l.driveMins}min): ${l.bestScore}/100` +
    (l.isAstroWin
      ? ` best astro ${l.bestAstroHour || 'evening'}${l.darkSky ? ' (dark sky)' : ''}`
      : ` ${dayAlternativeTiming(l.bestDayHour)}`)
  ).join('\n')}`;
}
