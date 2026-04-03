import { clamp } from './utils.js';

export interface SiteDarkness {
  bortle: number;
  siteDarknessScore: number;
  source: string;
  lookupDate: string;
}

// Source note: initial static estimates were manually seeded from Light Pollution Map /
// VIIRS-backed sky-brightness inspection on 2026-03-16 for this first in-repo pass.
export const SITE_DARKNESS_SOURCE = 'Light Pollution Map / VIIRS-backed manual estimate';
export const SITE_DARKNESS_LOOKUP_DATE = '2026-03-16';

export function siteDarknessFromBortle(bortle: number): SiteDarkness {
  return {
    bortle,
    siteDarknessScore: clamp(Math.round((9 - bortle) * 12.5)),
    source: SITE_DARKNESS_SOURCE,
    lookupDate: SITE_DARKNESS_LOOKUP_DATE,
  };
}

export function isDarkSkySite(siteDarkness: SiteDarkness): boolean {
  return siteDarkness.bortle <= 3;
}

export function astroDarknessBonus(siteDarkness: SiteDarkness): number {
  return Math.round(siteDarkness.siteDarknessScore / 10);
}

export const HOME_SITE_DARKNESS = siteDarknessFromBortle(7);
