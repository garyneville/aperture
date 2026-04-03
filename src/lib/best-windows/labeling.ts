/**
 * Window labeling.
 *
 * Generates human-readable labels for windows based on their timing,
 * session type, and characteristics.
 */

import type { WindowCandidate } from './types.js';

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.filter(Boolean))];
}

/**
 * Generate a headline tag string for a window.
 */
export function headlineTagsForWindow(window: { label: string; tops?: string[] }): string {
  const tags: string[] = [];
  const lowerLabel = window.label.toLowerCase();

  if (lowerLabel.includes('astro')) tags.push('astrophotography');
  if (lowerLabel.includes('golden')) tags.push('golden hour');
  if (lowerLabel.includes('blue')) tags.push('blue hour');
  if (lowerLabel.includes('mist')) tags.push('atmospheric');

  tags.push(...(window.tops || []));

  return uniqueTags(tags).slice(0, 2).join(', ');
}

/**
 * Generate a human-readable label for a window candidate.
 *
 * @param w - Window candidate
 * @param sunrise - Sunrise timestamp
 * @param sunset - Sunset timestamp
 * @returns Human-readable label string
 */
export function labelWindow(w: WindowCandidate, sunrise?: string, sunset?: string): string {
  if (w.labelHint) return w.labelHint;

  const sunrD = sunrise ? new Date(sunrise) : null;
  const sunsetD = sunset ? new Date(sunset) : null;
  const s = new Date(w.st);
  const astroHours = w.hours.filter(h => h.isNight && h.astro > 35);

  if (astroHours.length) {
    const astroHourNumbers = astroHours
      .map(hour => Number.parseInt(hour.hour.slice(0, 2), 10))
      .filter(hour => Number.isFinite(hour));
    const allOvernight = astroHourNumbers.length > 0 && astroHourNumbers.every(hour => hour < 6);
    const allEvening = astroHourNumbers.length > 0 && astroHourNumbers.every(hour => hour >= 18);
    const minAstroHour = astroHourNumbers.length > 0 ? Math.min(...astroHourNumbers) : 0;

    if (w.fallback) {
      if (allEvening) return 'Best chance for evening astro';
      if (allOvernight) return minAstroHour >= 3 ? 'Best chance for pre-dawn astro' : 'Best chance for midnight astro';
      return 'Best chance for night sky';
    }

    if (allEvening) return 'Evening astro window';
    if (allOvernight) return minAstroHour >= 3 ? 'Pre-dawn astro window' : 'Midnight astro window';
    return 'Night sky window';
  }

  if (w.fallback) {
    if (w.hours.some(h => h.isGoldPm || h.isBluePm)) return 'Best chance around sunset';
    if (w.hours.some(h => h.isGoldAm || h.isBlueAm)) return 'Best chance around sunrise';
  }

  if (w.hours.some(h => h.isBlue && !h.isGolden)) return 'Blue hour';
  if (w.hours.some(h => h.isGolden) && sunrD && s < new Date(+sunrD + 4 * 3600000)) return 'Morning golden hour';
  if (w.hours.some(h => h.isGolden) && sunsetD && s > new Date(+sunsetD - 8 * 3600000)) return 'Evening golden hour';
  if (w.hours.some(h => h.isBlue)) return 'Blue hour';
  if (w.hours.some(h => h.mist > 40)) return 'Misty / atmospheric';
  return 'Good light window';
}
