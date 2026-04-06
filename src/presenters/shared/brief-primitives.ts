import { esc } from '../../lib/utils.js';
import { WEATHER_ICON_SVGS } from '../../lib/weather-icons.js';
import { MOON_ICON_SVGS } from '../../lib/moon-icons.js';
import {
  ColorPage,
  ColorSurface,
  ColorSurfaceVariant,
  ColorOutline,
  ColorShadow,
  ColorInk,
  ColorMuted,
  ColorSubtle,
  ColorPrimary,
  ColorPrimaryContainer,
  ColorOnPrimaryContainer,
  ColorSecondary,
  ColorSecondaryContainer,
  ColorOnSecondaryContainer,
  ColorTertiary,
  ColorWarning,
  ColorWarningContainer,
  ColorSuccess,
  ColorSuccessContainer,
  ColorError,
  ColorErrorContainer,
  ColorAccent,
  ColorAccentContainer,
  ColorBrand,
  ColorHeroGradientStart,
  ColorHeroGradientEnd,
  TypographyFontFamilyBase,
  TypographyFontFamilyMono,
} from '../../tokens/tokens.js';
import type { CarWash, DaySummary, NextDayHour } from '../../contracts/index.js';

export const C = {
  page: ColorPage,
  surface: ColorSurface,
  surfaceVariant: ColorSurfaceVariant,
  outline: ColorOutline,
  ink: ColorInk,
  muted: ColorMuted,
  subtle: ColorSubtle,
  primary: ColorPrimary,
  primaryContainer: ColorPrimaryContainer,
  onPrimaryContainer: ColorOnPrimaryContainer,
  secondary: ColorSecondary,
  secondaryContainer: ColorSecondaryContainer,
  onSecondaryContainer: ColorOnSecondaryContainer,
  tertiary: ColorTertiary,
  warning: ColorWarning,
  warningContainer: ColorWarningContainer,
  success: ColorSuccess,
  successContainer: ColorSuccessContainer,
  error: ColorError,
  errorContainer: ColorErrorContainer,
  shadow: ColorShadow,
  accent: ColorAccent,
  accentContainer: ColorAccentContainer,
  brand: ColorBrand,
  heroGradientStart: ColorHeroGradientStart,
  heroGradientEnd: ColorHeroGradientEnd,
} as const;

export const FONT = TypographyFontFamilyBase;
export const MONO = TypographyFontFamilyMono;
export const UTILITY_GLYPHS = '<span aria-hidden="true">&#x1F697; / &#x1F6B6;</span>';
export const BRAND_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style="vertical-align:middle;display:inline-block;"><circle cx="11" cy="11" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="11" cy="11" r="3.5" fill="currentColor"/></svg>`;

export const SCORE_THRESHOLDS = { excellent: 75, good: 58, marginal: 42 } as const;

export function scoreState(score: number): { label: string; fg: string; bg: string; border: string } {
  if (score >= SCORE_THRESHOLDS.excellent) return { label: 'Excellent', fg: C.success, bg: C.successContainer, border: '#A3D9B1' };
  if (score >= SCORE_THRESHOLDS.good) return { label: 'Good', fg: C.onPrimaryContainer, bg: C.primaryContainer, border: '#A8D4FB' };
  if (score >= SCORE_THRESHOLDS.marginal) return { label: 'Marginal', fg: C.warning, bg: C.warningContainer, border: '#EDD17B' };
  return { label: 'Poor', fg: C.error, bg: C.errorContainer, border: '#ECACA5' };
}

export function confidenceDetail(confidence: string | undefined | null): { label: string; fg: string; bg: string; border: string } | null {
  if (!confidence || confidence === 'unknown') return null;
  if (confidence === 'high') {
    return { label: 'High certainty', fg: C.success, bg: C.successContainer, border: '#A3D9B1' };
  }
  if (confidence === 'medium') {
    return { label: 'Fair certainty', fg: C.warning, bg: C.warningContainer, border: '#EDD17B' };
  }
  if (confidence === 'very-low') {
    return { label: 'Very low certainty', fg: C.error, bg: C.errorContainer, border: '#ECACA5' };
  }
  return { label: 'Low certainty', fg: C.error, bg: C.errorContainer, border: '#ECACA5' };
}

export function effectiveConf(
  day: DaySummary,
  isAstroLed: boolean,
): { confidence: string | undefined; stdDev: number | null | undefined } {
  if (isAstroLed) {
    const astroConfidence = day.astroConfidence;
    if (!astroConfidence || astroConfidence === 'unknown') return { confidence: undefined, stdDev: undefined };
    return { confidence: astroConfidence, stdDev: day.astroConfidenceStdDev };
  }
  return { confidence: day.confidence, stdDev: day.confidenceStdDev };
}

export function dewRiskEntry(tpw: number | undefined, tempC: number | undefined): Array<{ label: string; value: string; tone: string }> {
  if (tpw === undefined || tpw < 15) return [];
  if (tpw > 30 && (tempC === undefined || tempC < 12)) {
    return [{ label: 'Dew risk', value: 'High', tone: C.error }];
  }
  if (tempC !== undefined && tempC >= 16) return [];
  return [{ label: 'Dew risk', value: 'Moderate', tone: C.secondary }];
}

export function daylightUtilityLine(cw: CarWash): string {
  const utilityWindow = cw.start !== '\u2014' ? `${cw.start}-${cw.end}` : '\u2014';
  return `${UTILITY_GLYPHS} Daylight utility: ${esc(utilityWindow)} <span style="color:${C.subtle};">&middot;</span> Wind ${esc(String(cw.wind))}km/h <span style="color:${C.subtle};">&middot;</span> Rain ${esc(String(cw.pp))}% <span style="color:${C.subtle};">&middot;</span> Temp ${esc(String(cw.tmp ?? '-'))}C`;
}

export interface SummaryStat {
  label: string;
  value: string;
  tone?: string;
}

export function dayHeading(day: DaySummary): string {
  const short = new Date(`${day.dateKey}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  if (day.dayIdx === 0) return `Today - ${short}`;
  if (day.dayIdx === 1) return `Tomorrow - ${short}`;
  return `${day.dayLabel} ${short}`;
}

export function weatherIconForHour(h: Pick<NextDayHour, 'ct' | 'pp' | 'pr' | 'isNight'>, size = 20): string {
  let condition: string;
  if (h.pr >= 2 || h.pp >= 80) {
    condition = 'rain';
  } else if (h.pr > 0 || h.pp >= 45) {
    condition = h.isNight ? 'partly-cloudy-night-rain' : 'partly-cloudy-day-rain';
  } else if (h.ct <= 20) {
    condition = h.isNight ? 'clear-night' : 'clear-day';
  } else if (h.ct <= 60) {
    condition = h.isNight ? 'partly-cloudy-night' : 'partly-cloudy-day';
  } else {
    condition = 'cloudy';
  }

  const svg = WEATHER_ICON_SVGS[condition];
  if (!svg) return '';
  const prefix = `wx-${condition}`;
  const scoped = svg
    .replace(/\bid="([^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/\burl\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
    .replace(/\bhref="#([^"]+)"/g, `href="#${prefix}-$1"`)
    .replace(/\bxlink:href="#([^"]+)"/g, `xlink:href="#${prefix}-$1"`);
  return scoped.replace('<svg ', `<svg data-condition="${condition}" width="${size}" height="${size}" `);
}

export function moonIconForPct(moonPct: number, size = 14): string {
  let condition: string;
  if (moonPct <= 15) condition = 'moon-new';
  else if (moonPct <= 40) condition = 'moon-waxing-crescent';
  else if (moonPct <= 70) condition = 'moon-first-quarter';
  else if (moonPct <= 90) condition = 'moon-waxing-gibbous';
  else condition = 'moon-full';

  const svg = MOON_ICON_SVGS[condition];
  if (!svg) return '';
  const prefix = `mn-${condition}`;
  const scoped = svg
    .replace(/\bid="([^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/\burl\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
    .replace(/\bhref="#([^"]+)"/g, `href="#${prefix}-$1"`)
    .replace(/\bxlink:href="#([^"]+)"/g, `xlink:href="#${prefix}-$1"`);
  return scoped.replace('<svg ', `<svg width="${size}" height="${size}" style="vertical-align:middle;" `);
}
