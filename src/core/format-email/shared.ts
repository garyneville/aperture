import { esc } from '../utils.js';
import { WEATHER_ICON_SVGS } from '../weather-icons.js';
import { MOON_ICON_SVGS } from '../moon-icons.js';
import {
  renderEmailCard,
  renderEmailHeroCard,
  renderEmailSectionTitle,
} from '../email-layout.js';
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
import type { CarWash, DaySummary, NextDayHour } from './types.js';

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

export function htmlText(text: string): string {
  const safe = esc(text || '');
  return safe
    .split(/\n{2,}/)
    .map(chunk => `<p style="Margin:0 0 10px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};">${chunk.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

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

export function pill(text: string, fg: string, bg: string, border: string): string {
  return `<span class="pill" style="display:inline-block;padding:4px 12px;border-radius:20px;background:${bg};border:1px solid ${border};font-family:${FONT};font-size:12px;font-weight:600;line-height:1.4;color:${fg};">${esc(text)}</span>`;
}

export function metricChip(label: string, value: string | number, tone?: string): string {
  const toneColor = tone || C.primary;
  return `<span class="chip" style="display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:6px;background:${C.surfaceVariant};border:1px solid ${C.outline};font-family:${FONT};font-size:11px;line-height:1.3;color:${C.ink};"><span style="font-weight:600;color:${toneColor};">${esc(label)}</span> ${esc(value)}</span>`;
}

export function metricRun(items: Array<{ label: string; value: string | number; tone?: string }>): string {
  return items
    .map(item => `<span style="display:inline;color:${C.ink};"><span style="font-weight:600;color:${item.tone || C.primary};">${esc(item.label)}</span> ${esc(item.value)}</span>`)
    .join(`<span style="color:${C.subtle};padding:0 2px;"> &middot; </span>`);
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

export function summaryGrid(items: SummaryStat[], columns = 2): string {
  const rows: SummaryStat[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;">
    ${rows.map(row => `
      <tr>
        ${row.map((item, itemIndex) => `
          <td valign="top" style="width:${100 / columns}%;padding:0;${itemIndex > 0 ? 'border-left:1px solid rgba(255,255,255,0.2);' : ''}">
            <div style="padding:10px 12px;">
              <div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:rgba(255,255,255,0.7);">${esc(item.label)}</div>
              <div style="Margin-top:4px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.3;color:#FFFFFF;">${esc(item.value)}</div>
            </div>
          </td>
        `).join('')}
        ${row.length < columns ? `<td style="width:${100 / columns}%;padding:0;border-left:1px solid rgba(255,255,255,0.2);">&nbsp;</td>`.repeat(columns - row.length) : ''}
      </tr>
    `).join('')}
  </table>`;
}

export function spacer(size: number): string {
  return `<tr><td style="height:${size}px;line-height:${size}px;font-size:${size}px;">&nbsp;</td></tr>`;
}

export function card(inner: string, extraClass = '', extraStyle = ''): string {
  const content = extraStyle
    ? `<div style="${extraStyle}">${inner}</div>`
    : inner;
  const rowWrappedContent = `<tr><td style="padding:0;">${content}</td></tr>`;
  return extraClass.includes('hero-card')
    ? renderEmailHeroCard(rowWrappedContent)
    : renderEmailCard(rowWrappedContent);
}

export function sectionTitle(title: string): string {
  return renderEmailSectionTitle(esc(title));
}

export function creativeSpark(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;background:${C.surface};border:1px solid ${C.outline};border-radius:12px;box-shadow:0 1px 3px ${C.shadow};">
    <tr>
      <td style="padding:20px 22px 22px;">
        <div style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.brand};margin-bottom:14px;">✦ Creative spark</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:0.75;color:${C.brand};opacity:0.22;margin-bottom:6px;">&ldquo;</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:${C.ink};font-style:italic;padding:0 4px;">${esc(text)}</div>
      </td>
    </tr>
  </table>`;
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

export function scorePill(score: number, suffix?: string): string {
  const state = scoreState(score);
  const label = `${state.label} - ${score}/100${suffix ? ` ${suffix}` : ''}`;
  return pill(label, state.fg, state.bg, state.border);
}

export function listRows(items: string[]): string {
  return items.filter(Boolean).join('<div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>');
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
