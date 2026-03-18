import { explainAstroScoreGap } from './astro-score-explanation.js';
import { esc } from './utils.js';
import { WEATHER_ICON_SVGS } from './weather-icons.js';
import { MOON_ICON_SVGS } from './moon-icons.js';
import { auroraVisibleKpThresholdForLat, isAuroraLikelyVisibleAtLat } from './aurora-visibility.js';
import { renderAiBriefingText } from './ai-briefing.js';
import {
  renderEmailCard,
  renderEmailHeroCard,
  renderEmailSectionTitle,
  renderMainEmailDocument,
} from './email-layout.js';
import type { DebugContext, DebugKitAdvisoryRule, DebugOutdoorComfortHour } from './debug-context.js';
import type { AuroraSignal } from './aurora-providers.js';
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
  ColorTertiaryContainer,
  ColorWarning,
  ColorWarningContainer,
  ColorSuccess,
  ColorSuccessContainer,
  ColorError,
  ColorErrorContainer,
  ColorAccent,
  ColorAccentContainer,
  ColorBrand,
  ColorHeroSurface,
  ColorHeroGradientStart,
  ColorHeroGradientEnd,
  TypographyFontFamilyBase,
  TypographyFontFamilyMono,
} from '../tokens/tokens.js';
import { getPhotoWeatherLat } from '../config.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WindowHour {
  hour?: string;
  score: number;
  ch?: number;
  visK?: number;
  wind?: string;
  pp?: number;
  crepuscular?: number;
  tpw?: number;
  tmp?: number;
}

export interface Window {
  label: string;
  start: string;
  end: string;
  peak: number;
  darkPhaseStart?: string | null;
  postMoonsetScore?: number | null;
  fallback?: boolean;
  hours?: WindowHour[];
  tops?: string[];
}

export interface AltLocation {
  name: string;
  driveMins: number;
  bestScore: number;
  bestDayHour?: string | null;
  bestAstroHour?: string | null;
  types?: string[];
  isAstroWin?: boolean;
  darkSky?: boolean;
  amScore?: number;
  pmScore?: number;
  dayScore?: number;
  astroScore?: number;
  /** Elevation of the location in metres (for upland context display). */
  elevationM?: number;
  /** True when the location is an upland site (elevationM >= 300m). */
  isUpland?: boolean;
  /** Max snow depth on the ground today (cm), null when no snow or no data. */
  snowDepthCm?: number | null;
  /** Total snowfall today (cm), null when no snow or no data. */
  snowfallCm?: number | null;
  siteDarkness?: {
    bortle: number;
  };
}

export interface CarWash {
  rating: string;
  label: string;
  score: number;
  start: string;
  end: string;
  wind: number;
  pp: number;
  tmp?: number;
}

export interface NextDayHour {
  hour: string;
  tmp: number;
  pp: number;
  wind: number;
  gusts: number;
  visK: number;
  pr: number;
  ct: number;
  isNight: boolean;
  moon?: number;
}

interface RunTimeContext {
  nowMinutes: number;
  nowLabel: string;
  timezone: string;
}

interface WindowDisplayPlan {
  primary: Window | null;
  remaining: Window[];
  past: Window[];
  promotedFromPast: boolean;
  allPast: boolean;
}

export interface DaySummary {
  dayLabel: string;
  dateKey: string;
  dayIdx: number;
  photoScore: number;
  headlineScore?: number;
  photoEmoji: string;
  amScore?: number;
  pmScore?: number;
  astroScore?: number;
  bestAstroHour?: string | null;
  darkSkyStartsAt?: string | null;
  confidence?: string;
  confidenceStdDev?: number | null;
  astroConfidence?: string;
  astroConfidenceStdDev?: number | null;
  amConfidence?: string;
  pmConfidence?: string;
  bestPhotoHour?: string;
  bestTags?: string;
  bestAlt?: AltLocation | null;
  carWash: CarWash;
  hours?: NextDayHour[];
}

export interface FormatEmailInput {
  dontBother: boolean;
  windows: Window[];
  todayCarWash: CarWash;
  dailySummary: DaySummary[];
  altLocations: AltLocation[];
  closeContenders?: AltLocation[];
  noAltsMsg?: string;
  sunriseStr: string;
  sunsetStr: string;
  moonPct: number;
  metarNote?: string;
  today: string;
  todayBestScore: number;
  shSunsetQ: number | null;
  shSunriseQ: number | null;
  shSunsetText?: string;
  sunDir: number | null;
  crepPeak: number;
  aiText: string;
  compositionBullets?: string[];
  weekInsight?: string;
  peakKpTonight?: number | null;
  auroraSignal?: AuroraSignal | null;
  longRangeTop?: LongRangeCard | null;
  longRangeCardLabel?: string | null;
  darkSkyAlert?: DarkSkyAlertCard | null;
  spurOfTheMoment?: SpurOfTheMomentSuggestion | null;
  geminiInspire?: string;
  debugContext?: DebugContext;
}

export interface LongRangeCard {
  name: string;
  region: string;
  driveMins: number;
  bestScore: number;
  amScore?: number;
  pmScore?: number;
  dayScore?: number;
  astroScore?: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  isAstroWin: boolean;
  darkSky: boolean;
  elevation: number;
  tags: string[];
}

export interface DarkSkyAlertCard {
  name: string;
  region: string;
  driveMins: number;
  astroScore: number;
  bestAstroHour: string | null;
}

export interface SpurOfTheMomentSuggestion {
  locationName: string;
  region: string;
  driveMins: number;
  tags: string[];
  darkSky: boolean;
  hookLine: string;
  confidence: number;
}

/* ------------------------------------------------------------------ */
/*  Brand colour system (imported from design tokens)                  */
/* ------------------------------------------------------------------ */

const C = {
  // Page & surface
  page: ColorPage,
  surface: ColorSurface,
  surfaceVariant: ColorSurfaceVariant,
  outline: ColorOutline,
  // Ink
  ink: ColorInk,
  muted: ColorMuted,
  subtle: ColorSubtle,
  // Semantic score / status colours
  primary: ColorPrimary,
  primaryContainer: ColorPrimaryContainer,
  onPrimaryContainer: ColorOnPrimaryContainer,
  secondary: ColorSecondary,
  secondaryContainer: ColorSecondaryContainer,
  onSecondaryContainer: ColorOnSecondaryContainer,
  tertiary: ColorTertiary,
  tertiaryContainer: ColorTertiaryContainer,
  warning: ColorWarning,
  warningContainer: ColorWarningContainer,
  success: ColorSuccess,
  successContainer: ColorSuccessContainer,
  error: ColorError,
  errorContainer: ColorErrorContainer,
  shadow: ColorShadow,
  accent: ColorAccent,
  accentContainer: ColorAccentContainer,
  // Brand identity
  brand: ColorBrand,
  heroSurface: ColorHeroSurface,
  heroGradientStart: ColorHeroGradientStart,
  heroGradientEnd: ColorHeroGradientEnd,
};

/** DM Sans is a modern, humanist sans-serif with good email client support. System stack is the fallback. */
const FONT = TypographyFontFamilyBase;
/** Monospace font stack for debug email pre/code blocks. */
const MONO = TypographyFontFamilyMono;
const UTILITY_GLYPHS = '<span aria-hidden="true">&#x1F697; / &#x1F6B6;</span>';

/** Inline SVG brand mark — clean aperture ring + centre dot, renders as the brand amber in the hero. */
const BRAND_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style="vertical-align:middle;display:inline-block;"><circle cx="11" cy="11" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="11" cy="11" r="3.5" fill="currentColor"/></svg>`;

/* ------------------------------------------------------------------ */
/*  HTML builder helpers                                               */
/* ------------------------------------------------------------------ */

function htmlText(text: string): string {
  const safe = esc(text || '');
  return safe
    .split(/\n{2,}/)
    .map(chunk => `<p style="Margin:0 0 10px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};">${chunk.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const SCORE_THRESHOLDS = { excellent: 75, good: 58, marginal: 42 } as const;

function scoreState(score: number): { label: string; fg: string; bg: string; border: string } {
  if (score >= SCORE_THRESHOLDS.excellent) return { label: 'Excellent', fg: C.success, bg: C.successContainer, border: '#A3D9B1' };
  if (score >= SCORE_THRESHOLDS.good) return { label: 'Good', fg: C.onPrimaryContainer, bg: C.primaryContainer, border: '#A8D4FB' };
  if (score >= SCORE_THRESHOLDS.marginal) return { label: 'Marginal', fg: C.warning, bg: C.warningContainer, border: '#EDD17B' };
  return { label: 'Poor', fg: C.error, bg: C.errorContainer, border: '#ECACA5' };
}

function confidenceDetail(confidence: string | undefined | null): { label: string; fg: string; bg: string; border: string } | null {
  if (!confidence || confidence === 'unknown') return null;
  if (confidence === 'high') {
    return { label: 'High certainty', fg: C.success, bg: C.successContainer, border: '#A3D9B1' };
  }
  if (confidence === 'medium') {
    return { label: 'Fair certainty', fg: C.warning, bg: C.warningContainer, border: '#EDD17B' };
  }
  return { label: 'Low certainty', fg: C.error, bg: C.errorContainer, border: '#ECACA5' };
}

/** Pick the contextually-correct confidence for a day, based on whether the lead window is astro. */
function effectiveConf(
  day: DaySummary,
  isAstroLed: boolean,
): { confidence: string | undefined; stdDev: number | null | undefined } {
  if (isAstroLed) {
    const ac = day.astroConfidence;
    if (!ac || ac === 'unknown') return { confidence: undefined, stdDev: undefined };
    return { confidence: ac, stdDev: day.astroConfidenceStdDev };
  }
  return { confidence: day.confidence, stdDev: day.confidenceStdDev };
}

function pill(text: string, fg: string, bg: string, border: string): string {
  return `<span class="pill" style="display:inline-block;padding:4px 12px;border-radius:20px;background:${bg};border:1px solid ${border};font-family:${FONT};font-size:12px;font-weight:600;line-height:1.4;color:${fg};">${esc(text)}</span>`;
}

function metricChip(label: string, value: string | number, tone?: string): string {
  const toneColor = tone || C.primary;
  return `<span class="chip" style="display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:6px;background:${C.surfaceVariant};border:1px solid ${C.outline};font-family:${FONT};font-size:11px;line-height:1.3;color:${C.ink};"><span style="font-weight:600;color:${toneColor};">${esc(label)}</span> ${esc(value)}</span>`;
}

function metricRun(items: Array<{ label: string; value: string | number; tone?: string }>): string {
  return items
    .map(item => `<span style="display:inline;color:${C.ink};"><span style="font-weight:600;color:${item.tone || C.primary};">${esc(item.label)}</span> ${esc(item.value)}</span>`)
    .join(`<span style="color:${C.subtle};padding:0 2px;"> &middot; </span>`);
}

function dewRiskEntry(tpw: number | undefined, tempC: number | undefined): Array<{ label: string; value: string; tone: string }> {
  if (tpw === undefined || tpw < 15) return [];
  if (tpw > 30 && (tempC === undefined || tempC < 12)) {
    return [{ label: 'Dew risk', value: 'High', tone: C.error }];
  }
  if (tempC !== undefined && tempC >= 16) return [];
  return [{ label: 'Dew risk', value: 'Moderate', tone: C.secondary }];
}

function daylightUtilityLine(cw: CarWash): string {
  const utilityWindow = cw.start !== '\u2014' ? `${cw.start}-${cw.end}` : '\u2014';
  return `${UTILITY_GLYPHS} Daylight utility: ${esc(utilityWindow)} <span style="color:${C.subtle};">&middot;</span> Wind ${esc(String(cw.wind))}km/h <span style="color:${C.subtle};">&middot;</span> Rain ${esc(String(cw.pp))}% <span style="color:${C.subtle};">&middot;</span> Temp ${esc(String(cw.tmp ?? '-'))}C`;
}

/* ------------------------------------------------------------------ */
/*  Outdoor comfort scoring (run / walk windows)                       */
/* ------------------------------------------------------------------ */

/** Outdoor comfort score 0-100 suitable for a walk or run. */
export function outdoorComfortScore(h: Pick<NextDayHour, 'tmp' | 'pp' | 'wind' | 'visK' | 'pr'>): number {
  let score = 100;

  // Rain probability
  if (h.pp > 70)      score -= 50;
  else if (h.pp > 40) score -= 30;
  else if (h.pp > 20) score -= 15;
  else if (h.pp > 5)  score -= 5;

  // Wind speed (km/h)
  if (h.wind > 45)      score -= 45;
  else if (h.wind > 30) score -= 30;
  else if (h.wind > 20) score -= 15;
  else if (h.wind > 12) score -= 5;

  // Temperature
  if (h.tmp < 0)       score -= 35;
  else if (h.tmp < 4)  score -= 20;
  else if (h.tmp < 7)  score -= 10;
  else if (h.tmp > 32) score -= 15;
  else if (h.tmp > 27) score -= 5;

  // Visibility
  if (h.visK < 0.5)    score -= 40;
  else if (h.visK < 2) score -= 25;
  else if (h.visK < 5) score -= 10;

  // Actual precipitation
  if (h.pr > 3)        score -= 30;
  else if (h.pr > 1)   score -= 20;
  else if (h.pr > 0.2) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Returns the run/walk label and styling for a comfort score. */
export function outdoorComfortLabel(
  score: number,
  h: Pick<NextDayHour, 'wind' | 'tmp' | 'pp'>,
): { text: string; fg: string; bg: string; highlight: boolean } {
  const MAX_RUN_WIND_KMH = 22;
  const MIN_RUN_TEMP_C = 4;
  const MAX_RUN_TEMP_C = 25;
  const MAX_RUN_RAIN_PCT = 40;
  if (score >= 75) {
    const runFriendly = h.wind <= MAX_RUN_WIND_KMH && h.tmp >= MIN_RUN_TEMP_C && h.tmp <= MAX_RUN_TEMP_C && h.pp < MAX_RUN_RAIN_PCT;
    return {
      text: runFriendly ? 'Best for a run' : 'Best for a walk',
      fg: C.success,
      bg: C.successContainer,
      highlight: true,
    };
  }
  if (score >= 55) return { text: 'Pleasant', fg: C.secondary, bg: C.secondaryContainer, highlight: true };
  if (score >= 35) return { text: 'Acceptable', fg: C.muted, bg: C.surfaceVariant, highlight: false };
  return { text: 'Poor conditions', fg: C.error, bg: C.errorContainer, highlight: false };
}

function outdoorComfortReason(h: Pick<NextDayHour, 'tmp' | 'pp' | 'wind' | 'visK' | 'pr'>): string {
  const reasons: string[] = [];
  if (h.pr > 1 || h.pp >= 60) reasons.push('rain-heavy');
  else if (h.pr > 0.2 || h.pp >= 35) reasons.push('rain risk');

  if (h.wind >= 35) reasons.push('strong wind');
  else if (h.wind >= 22) reasons.push('breezy');

  if (h.tmp < 3) reasons.push('cold');
  else if (h.tmp > 28) reasons.push('warm');

  if (h.visK < 2) reasons.push('low visibility');

  if (!reasons.length) return '';
  return reasons.slice(0, 2).join(', ');
}

function moonDescriptor(moonPct: number): string {
  if (moonPct <= 5) return 'New-ish';
  if (moonPct <= 35) return 'Crescent';
  if (moonPct <= 65) return 'Half moon';
  if (moonPct <= 90) return 'Gibbous';
  return 'Full-ish';
}

function moonAstroContext(moonPct: number): string {
  const icon = moonIconForPct(moonPct);
  if (moonPct <= 15) return `${icon} ${esc('Dark skies — excellent for astrophotography')}`;
  if (moonPct <= 40) return `${icon} ${esc('Low moon glow — good for astrophotography')}`;
  if (moonPct <= 70) return `${icon} ${esc('Moderate moon — astrophotography compromised')}`;
  if (moonPct <= 90) return `${icon} ${esc('Bright moon — poor for astrophotography')}`;
  return `${icon} ${esc('Full moon — avoid astrophotography')}`;
}

interface SummaryStat {
  label: string;
  value: string;
  tone?: string;
}

function summaryGrid(items: SummaryStat[], columns = 2): string {
  const rows: SummaryStat[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;">
    ${rows.map(row => `
      <tr>
        ${row.map((item, itemIndex) => `
          <td valign="top" style="width:${100 / columns}%;padding:0;${itemIndex > 0 ? `border-left:1px solid rgba(255,255,255,0.2);` : ''}">
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

function summaryNote(label: string, value: string): string {
  const content = esc(value).replace(/\n/g, '<br>');
  return `<div style="Margin-top:12px;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:rgba(255,255,255,0.7);">${esc(label)}</div>
    <div style="Margin-top:5px;font-family:${FONT};font-size:14px;line-height:1.5;color:rgba(255,255,255,0.92);">${content}</div>
  </div>`;
}

function spacer(size: number): string {
  return `<tr><td style="height:${size}px;line-height:${size}px;font-size:${size}px;">&nbsp;</td></tr>`;
}

function card(inner: string, extraClass = '', extraStyle = ''): string {
  const content = extraStyle
    ? `<div style="${extraStyle}">${inner}</div>`
    : inner;
  const rowWrappedContent = `<tr><td style="padding:0;">${content}</td></tr>`;
  return extraClass.includes('hero-card')
    ? renderEmailHeroCard(rowWrappedContent)
    : renderEmailCard(rowWrappedContent);
}

function sectionTitle(title: string): string {
  return renderEmailSectionTitle(esc(title));
}

function creativeSpark(text: string): string {
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

function dayHeading(day: DaySummary): string {
  const short = new Date(day.dateKey + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  if (day.dayIdx === 0) return `Today - ${short}`;
  if (day.dayIdx === 1) return `Tomorrow - ${short}`;
  return `${day.dayLabel} ${short}`;
}

function scorePill(score: number, suffix?: string): string {
  const state = scoreState(score);
  const label = `${state.label} - ${score}/100${suffix ? ` ${suffix}` : ''}`;
  return pill(label, state.fg, state.bg, state.border);
}

function confidencePill(day: DaySummary, isAstroLed = false): string {
  const { confidence, stdDev } = effectiveConf(day, isAstroLed);
  const detail = confidenceDetail(confidence);
  if (!detail) return '';
  const spread = stdDev !== null && stdDev !== undefined
    ? `${detail.label} - spread ${stdDev} pts`
    : detail.label;
  return pill(spread, detail.fg, detail.bg, detail.border);
}

function listRows(items: string[]): string {
  return items.filter(Boolean).join('<div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>');
}

function isAstroWindow(window: Window | undefined): boolean {
  if (!window) return false;
  return window.label.toLowerCase().includes('astro') || (window.tops || []).includes('astrophotography');
}

function peakHourForWindow(window: Window | undefined): string | null {
  if (!window?.hours?.length) return null;
  const peakHour = window.hours.find(hour => hour.score === window.peak) || window.hours[window.hours.length - 1];
  return peakHour?.hour || null;
}

function windowRange(w: { start: string; end: string }): string {
  return w.start === w.end ? w.start : `${w.start}-${w.end}`;
}

function clockToMinutes(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

function minutesToClock(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getRunTimeContext(debugContext?: DebugContext): RunTimeContext {
  const metadata = debugContext?.metadata;
  const timezone = metadata?.timezone || 'Europe/London';
  const now = metadata?.generatedAt ? new Date(metadata.generatedAt) : null;
  if (!now) {
    return { nowMinutes: 0, nowLabel: '00:00', timezone };
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === 'hour')?.value || '0');
  const minute = Number(parts.find(part => part.type === 'minute')?.value || '0');
  return {
    nowMinutes: (hour * 60) + minute,
    nowLabel: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    timezone,
  };
}

function classifyWindowTiming(window: Window, nowMinutes: number): 'past' | 'current' | 'future' {
  const startMinutes = clockToMinutes(window.start);
  const endMinutes = clockToMinutes(window.end);
  if (startMinutes === null || endMinutes === null) return 'future';
  if (endMinutes < nowMinutes) return 'past';
  if (startMinutes <= nowMinutes) return 'current';
  return 'future';
}

function buildWindowDisplayPlan(windows: Window[] | undefined, nowMinutes: number): WindowDisplayPlan {
  const allWindows = windows || [];
  if (!allWindows.length) {
    return { primary: null, remaining: [], past: [], promotedFromPast: false, allPast: false };
  }

  const remaining = allWindows
    .filter(window => classifyWindowTiming(window, nowMinutes) !== 'past')
    .sort((a, b) => (clockToMinutes(a.start) ?? 0) - (clockToMinutes(b.start) ?? 0));
  const past = allWindows
    .filter(window => classifyWindowTiming(window, nowMinutes) === 'past')
    .sort((a, b) => (clockToMinutes(a.start) ?? 0) - (clockToMinutes(b.start) ?? 0));
  const primary = remaining[0] || allWindows[0] || null;
  const originalPrimary = allWindows[0] || null;

  return {
    primary,
    remaining,
    past,
    promotedFromPast: Boolean(primary && originalPrimary && primary !== originalPrimary),
    allPast: remaining.length === 0,
  };
}

function timeAwareBriefingFallback(plan: WindowDisplayPlan): string | null {
  const earlier = plan.past[0] || null;
  if (plan.promotedFromPast && earlier && plan.primary) {
    return `${earlier.label} ${windowRange(earlier)} was earlier today. ${plan.primary.label} ${windowRange(plan.primary)} is the best remaining local option.`;
  }
  if (plan.allPast && earlier) {
    return `${earlier.label} ${windowRange(earlier)} was the strongest local window earlier today. No local photo window remains today.`;
  }
  return null;
}

function timeAwareLocalSummary(
  plan: WindowDisplayPlan,
  primary: Window | null,
  lines: string[],
): string {
  if (plan.promotedFromPast && primary && plan.past[0]) {
    const earlier = plan.past[0];
    return [
      `${earlier.label}: ${windowRange(earlier)} at ${earlier.peak}/100 earlier today.`,
      `${primary.label}: ${windowRange(primary)} at ${primary.peak}/100 is the best remaining local option.`,
      ...lines,
    ].filter(Boolean).join('\n');
  }
  if (plan.allPast && plan.past[0]) {
    const earlier = plan.past[0];
    return `${earlier.label}: ${windowRange(earlier)} at ${earlier.peak}/100 was the strongest local window earlier today. No local photo window remains today.`;
  }
  return lines.filter(Boolean).join('\n');
}

function displayTag(tag: string): string {
  const normalized = tag.trim().toLowerCase();
  const tagMap: Record<string, string> = {
    astrophotography: 'astro',
    'clear light path': 'clear horizon',
    'misty / atmospheric': 'atmospheric',
  };
  return tagMap[normalized] || tag.trim();
}

function bestTimeLabel(window: Window | null | undefined): string {
  if (isAstroWindow(window ?? undefined)) return 'Best astro';
  if (window && !window.fallback) return 'Best light';
  return 'Best time';
}

function peakTimeNote(window: Window | null | undefined, peakHour: string | undefined): string {
  if (!window || !peakHour) return '';
  if (window.start === window.end) return '';
  const label = bestTimeLabel(window);
  if (peakHour === window.end) return `${label}: ${peakHour}, near the end of the window.`;
  if (peakHour === window.start) return `${label}: ${peakHour}, right as the window opens.`;
  return `${label}: ${peakHour}, within the window.`;
}

function displayBestTags(bestTags: string | undefined, fallback = 'mixed conditions'): string {
  if (!bestTags) return fallback;
  const visibleTags = bestTags
    .split(',')
    .map(tag => tag.trim())
    .map(tag => displayTag(tag))
    .filter(tag => tag && tag !== 'general' && tag !== 'poor');
  return visibleTags.join(', ') || fallback;
}

function bestDaySessionLabel(bestDayHour: string | null | undefined): string {
  if (!bestDayHour) return 'Golden hour';
  const hour = Number.parseInt(bestDayHour.slice(0, 2), 10);
  if (!Number.isFinite(hour)) return 'Golden hour';
  return hour < 12 ? 'Morning golden hour' : 'Evening golden hour';
}

function forecastBestLine(day: DaySummary): string {
  const isAstroLed = (day.astroScore ?? 0) > (day.photoScore ?? 0);
  if (isAstroLed) {
    return `Best local astro around ${day.bestAstroHour || 'nightfall'}`;
  }
  return `Best at ${day.bestPhotoHour || '-'} - ${displayBestTags(day.bestTags)}`;
}

/* ------------------------------------------------------------------ */
/*  Kit advisory                                                        */
/* ------------------------------------------------------------------ */

export interface KitTip {
  id: string;
  text: string;
  priority: number;
}

interface KitRuleParams {
  windKmh: number;
  rainPct: number;
  tempC: number | undefined;
  visibilityKm: number | undefined;
  tpwMm: number | undefined;
  astroScore: number;
  isAstroWin: boolean;
  moonPct: number;
  astroWindow: Window | undefined;
  astroWindowIsPrimary: boolean;
}

interface KitRule {
  id: string;
  predicate: (params: KitRuleParams) => boolean;
  priority: number;
}

const KIT_RULES: KitRule[] = [
  {
    id: 'high-wind',
    predicate: ({ windKmh }) => windKmh > 25,
    priority: 10,
  },
  {
    id: 'rain-risk',
    predicate: ({ rainPct }) => rainPct > 40,
    priority: 9,
  },
  {
    id: 'fog-mist',
    predicate: ({ visibilityKm }) => visibilityKm !== undefined && visibilityKm < 5,
    priority: 8,
  },
  {
    id: 'astro-window',
    predicate: ({ astroScore, isAstroWin, moonPct }) => isAstroWin && astroScore >= 60 && moonPct < 60,
    priority: 7,
  },
  {
    id: 'cold',
    predicate: ({ tempC }) => tempC !== undefined && tempC < 2,
    priority: 6,
  },
  {
    id: 'high-moisture',
    predicate: ({ tpwMm, tempC }) => tpwMm !== undefined && tpwMm > 30 && (tempC === undefined || tempC < 12),
    priority: 5,
  },
];

function peakWindowHour(window: Window | undefined): WindowHour | undefined {
  if (!window?.hours?.length) return undefined;
  return window.hours.find(hour => hour.score === window.peak) || window.hours[0];
}

function astroWindowSignal(window: Window | undefined): number {
  if (!window) return 0;
  const hourPeak = Math.max(...(window.hours?.map(hour => hour.score) || [0]));
  return Math.max(window.peak || 0, window.postMoonsetScore || 0, hourPeak);
}

function bestAstroWindow(windows: Window[]): Window | undefined {
  return windows
    .filter(window => isAstroWindow(window))
    .sort((a, b) => astroWindowSignal(b) - astroWindowSignal(a))[0];
}

function buildKitTipText(ruleId: string, params: KitRuleParams): string {
  switch (ruleId) {
    case 'high-wind':
      return 'High wind: ballast your tripod or avoid long exposures; shoot parallel to gusts.';
    case 'rain-risk':
      return 'Rain expected: verify weather sealing on body and lens; pack a microfibre cloth for the front element.';
    case 'fog-mist':
      return 'Low visibility: telephoto compression will look great; switch to manual focus and bracket exposures.';
    case 'astro-window': {
      const astroWindow = params.astroWindow;
      const windowLabel = astroWindow
        ? `${params.astroWindowIsPrimary ? 'Astro window' : 'Later astro window'} ${windowRange(astroWindow)}`
        : 'Astro window';
      const darkPhaseNote = astroWindow?.darkPhaseStart ? ` Darker after ${astroWindow.darkPhaseStart}.` : '';
      return `${windowLabel}: fastest wide-aperture lens; intervalometer for star trails; red torch to preserve night vision.${darkPhaseNote}`;
    }
    case 'cold':
      return 'Near-freezing: battery performance drops - carry spares in an inside pocket.';
    case 'high-moisture':
      return 'High dew risk: atmospheric moisture may cause lens fogging - let glass acclimatise before shooting.';
    default:
      return '';
  }
}

function buildKitRuleParams(
  todayCarWash: CarWash,
  windows: Window[],
  astroScore: number,
  moonPct: number,
): KitRuleParams {
  const topWindow = windows?.[0];
  const topPeakHour = peakWindowHour(topWindow);
  const astroWindow = bestAstroWindow(windows || []);
  const astroPeakHour = peakWindowHour(astroWindow);
  const resolvedAstroScore = Math.max(
    astroScore || 0,
    astroWindowSignal(astroWindow),
  );

  return {
    windKmh: todayCarWash.wind,
    rainPct: todayCarWash.pp,
    tempC: todayCarWash.tmp,
    visibilityKm: topPeakHour?.visK ?? astroPeakHour?.visK,
    tpwMm: topPeakHour?.tpw ?? astroPeakHour?.tpw,
    astroScore: resolvedAstroScore,
    isAstroWin: Boolean(astroWindow),
    moonPct,
    astroWindow,
    astroWindowIsPrimary: Boolean(astroWindow && astroWindow === topWindow),
  };
}

export function buildKitTips(
  todayCarWash: CarWash,
  windows: Window[],
  astroScore: number,
  moonPct: number,
  maxTips = 3,
): KitTip[] {
  const params = buildKitRuleParams(todayCarWash, windows, astroScore, moonPct);

  return KIT_RULES
    .filter(rule => rule.predicate(params))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxTips)
    .map(rule => ({ id: rule.id, text: buildKitTipText(rule.id, params), priority: rule.priority }));
}

/** Evaluate all kit rules and return the full trace (for debug output). */
export function evaluateKitRules(
  todayCarWash: CarWash,
  windows: Window[],
  astroScore: number,
  moonPct: number,
  maxTips = 3,
): { trace: DebugKitAdvisoryRule[]; tipsShown: string[] } {
  const params = buildKitRuleParams(todayCarWash, windows, astroScore, moonPct);

  const thresholdLabels: Record<string, string> = {
    'high-wind': 'wind > 25 km/h',
    'rain-risk': 'rain > 40%',
    'fog-mist': 'visibility < 5 km',
    'astro-window': 'score ≥ 60, isAstroWin, moonPct < 60%',
    'cold': 'temp < 2°C',
    'high-moisture': 'TPW > 30mm + temp < 12°C',
  };

  const astroWindowLabel = params.astroWindow
    ? `${params.astroWindowIsPrimary ? 'primary' : 'later'} ${params.astroWindow.label} ${windowRange(params.astroWindow)}`
    : 'n/a';
  const optKm = params.visibilityKm !== undefined ? `${params.visibilityKm} km` : 'n/a';
  const optTemp = params.tempC !== undefined ? `${params.tempC}°C` : 'n/a';
  const optTpw = params.tpwMm !== undefined ? `${params.tpwMm}mm` : 'n/a';

  const valueLabels: Record<string, string> = {
    'high-wind': `${params.windKmh} km/h`,
    'rain-risk': `${params.rainPct}%`,
    'fog-mist': optKm,
    'astro-window': `score ${params.astroScore}/100, moonPct ${params.moonPct}%, astro ${params.isAstroWin ? 'Yes' : 'No'}, ${astroWindowLabel}`,
    'cold': optTemp,
    'high-moisture': `${optTpw} (temp ${optTemp})`,
  };

  const matchedRules = KIT_RULES
    .filter(rule => rule.predicate(params))
    .sort((a, b) => b.priority - a.priority);
  const shownRules = matchedRules.slice(0, maxTips);
  const shownIds = new Set(shownRules.map(rule => rule.id));

  const trace: DebugKitAdvisoryRule[] = KIT_RULES.map(rule => ({
    id: rule.id,
    threshold: thresholdLabels[rule.id] ?? '—',
    value: valueLabels[rule.id] ?? '—',
    matched: rule.predicate(params),
    shown: shownIds.has(rule.id),
  }));

  const tipsShown = shownRules.map(rule => rule.id);
  return { trace, tipsShown };
}

function kitAdvisoryCard(tips: KitTip[]): string {
  if (!tips.length) return '';
  const items = tips.map(tip =>
    `<div style="Margin-bottom:6px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};">&#x2022; ${esc(tip.text)}</div>`
  ).join('');
  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Kit advisory</div>
    <div style="Margin-top:4px;">${items}</div>
  `, '', `border-left:3px solid ${C.tertiary};`);
}

function windowCard(
  w: Window,
  index: number,
  windows: Window[],
  sectionLabel = index === 0 ? 'Best window' : 'Worth watching',
  peakKpTonight?: number | null,
): string {
  const h = w.hours?.find(x => x.score === w.peak) || w.hours?.[0] || {} as WindowHour;
  const notes: string[] = [];
  const topWindow = windows[0];
  if (w.fallback) notes.push('Most promising narrow stretch rather than a clean standout window.');
  if ((h.crepuscular || 0) > 45) notes.push(`Crepuscular ray potential: ${h.crepuscular}/100 (light shafts through broken cloud).`);
  if (w.darkPhaseStart && w.postMoonsetScore !== null && w.postMoonsetScore !== undefined) {
    notes.push(`Dark from ${w.darkPhaseStart} - peak after moonset ${w.postMoonsetScore}/100.`);
  }
  if (index === 0 && isAstroWindow(w) && isAuroraLikelyVisibleAtLat(getPhotoWeatherLat(), peakKpTonight)) {
    const threshold = auroraVisibleKpThresholdForLat(getPhotoWeatherLat());
    notes.push(`Coincides with an active aurora signal (Kp ${peakKpTonight?.toFixed(1) ?? 'unknown'} vs local threshold Kp ${threshold}) - favour a clean northern horizon.`);
  }
  if (index > 0 && isAstroWindow(topWindow) && isAstroWindow(w) && topWindow?.label !== w.label) {
    notes.push('Later, darker backup if you miss the first astro slot.');
  }
  const metricLine = metricRun([
    { label: 'Cloud high', value: `${h.ch ?? '-'}%`, tone: C.primary },
    { label: 'Visibility', value: `${h.visK ?? '-'}km`, tone: C.secondary },
    { label: 'Wind', value: `${h.wind ?? '-'}km/h`, tone: C.tertiary },
    { label: 'Rain', value: `${h.pp ?? '-'}%`, tone: C.error },
    ...(dewRiskEntry(h.tpw, h.tmp)),
  ]);
  const tags = (w.tops || []).length
    ? `<div style="Margin-top:10px;">${(w.tops || []).map(tag => metricChip(displayTag(tag), '', C.primary)).join('')}</div>`
    : '';
  const noteBlock = notes.length
    ? `<div style="Margin-top:10px;padding-top:12px;border-top:1px solid ${C.outline};font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(notes.join(' '))}</div>`
    : '';
  return card(`
    <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">${sectionLabel}</div>
    <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:600;line-height:1.24;letter-spacing:-0.01em;color:${C.ink};">${esc(w.label)}</div>
    <div style="Margin:4px 0 0;font-family:${FONT};font-size:14px;line-height:1.4;color:${C.muted};">${esc(windowRange(w))}</div>
    <div style="Margin-top:10px;">${scorePill(w.peak)}</div>
    <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};">${metricLine}</div>
    ${tags}
    ${noteBlock}
  `, '', index === 0 ? `border-top:3px solid ${scoreState(w.peak).fg};` : '');
}

function compositionCard(bullets: string[]): string {
  if (!bullets.length) return '';
  const items = bullets.map(b =>
    `<div style="Margin-bottom:6px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};">&#x2022; ${esc(b)}</div>`
  ).join('');
  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Shot ideas</div>
    <div style="Margin-top:4px;">${items}</div>
  `, '', `border-left:3px solid ${C.secondary};`);
}

function poorDayFallbackLine(windows: Window[] | undefined): string {
  const fallbackWindow = windows?.[0];
  if (!fallbackWindow) return 'If you still go: no clear local fallback window.';
  const peakHour = peakHourForWindow(fallbackWindow) || fallbackWindow.end || fallbackWindow.start;
  return `If you still go: ${fallbackWindow.label.toLowerCase()} around ${peakHour || 'time TBD'} at ${fallbackWindow.peak}/100.`;
}

function todayWindowSection(
  dontBother: boolean,
  todayBestScore: number,
  aiText: string,
  windows: Window[] | undefined,
  dailySummary: DaySummary[],
  altLocations: AltLocation[] | undefined,
  runTime: RunTimeContext,
  peakKpTonight: number | null | undefined,
  compositionBullets?: string[],
): string {
  const hasLocalWindow = (windows?.length || 0) > 0;
  const effectiveDontBother = dontBother || !hasLocalWindow;
  const displayPlan = buildWindowDisplayPlan(windows, runTime.nowMinutes);

  if (effectiveDontBother) {
    const headline = hasLocalWindow ? 'Not worth shooting locally' : 'No clear local window';
    return card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.error};">Today&apos;s call</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:600;line-height:1.24;letter-spacing:-0.01em;color:${C.ink};">${headline}</div>
      <div style="Margin-top:10px;">${scorePill(todayBestScore)}</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(poorDayFallbackLine(windows))}</div>
    `, '', `border-top:3px solid ${C.error};`);
  }
  const fallbackAiText = timeAwareBriefingFallback(displayPlan);
  const renderedAi = fallbackAiText
    ? { text: fallbackAiText, strippedOpener: false, usedFallback: true }
    : renderAiBriefingText(aiText, { dontBother, windows, dailySummary, altLocations, peakKpTonight });
  const trimmedAiText = renderedAi.text || aiText;
  const compCard = fallbackAiText ? '' : compositionCard(compositionBullets || []);
  const displayedWindows: string[] = [];

  if (!displayPlan.allPast && displayPlan.primary) {
    const primaryLabel = displayPlan.promotedFromPast
      ? 'Next window'
      : classifyWindowTiming(displayPlan.primary, runTime.nowMinutes) === 'current'
        ? 'Live now'
        : 'Best window';
    displayedWindows.push(windowCard(
      displayPlan.primary,
      0,
      [displayPlan.primary, ...displayPlan.remaining.filter(window => window !== displayPlan.primary)],
      primaryLabel,
      peakKpTonight,
    ));
    displayPlan.remaining
      .filter(window => window !== displayPlan.primary)
      .forEach((window, index) => {
        displayedWindows.push(windowCard(window, index + 1, displayPlan.remaining, 'Later today', peakKpTonight));
      });
  }

  displayPlan.past.forEach((window, index) => {
    displayedWindows.push(windowCard(window, index + 1, displayPlan.past, 'Earlier today', peakKpTonight));
  });

  return listRows([
    ...displayedWindows,
    card(`
      <div style="Margin:0 0 8px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:${C.subtle};">AI briefing</div>
      ${htmlText(trimmedAiText)}
    `),
    ...(compCard ? [compCard] : []),
  ]);
}

/** AuroraWatch UK level → display metadata (extracted for reuse and testability). */
const AWUK_LEVEL_META: Record<string, { label: string; fg: string; bg: string; border: string }> = {
  yellow: { label: 'Minor activity',    fg: C.warning, bg: C.warningContainer, border: '#EDD17B' },
  amber:  { label: 'Moderate activity', fg: C.warning, bg: C.warningContainer, border: '#DBA544' },
  red:    { label: 'Storm conditions',  fg: C.success, bg: C.successContainer, border: '#A3D9B1' },
};

const AWUK_LEVEL_DESCRIPTIONS: Record<string, string> = {
  yellow: 'Minor geomagnetic activity detected by UK magnetometers. Aurora may be visible from northern Scotland; conditions at 54°N (Leeds) are marginal.',
  amber:  'Moderate geomagnetic activity. Aurora possible across northern England on clear nights. Worth watching if skies are clear.',
  red:    'Storm-level geomagnetic activity. Aurora likely visible across much of the UK, including Yorkshire, on clear nights.',
};

function signalCards(
  shSunriseQ: number | null,
  shSunsetQ: number | null,
  shSunsetText: string | undefined,
  sunDir: number | null,
  crepPeak: number,
  metarNote: string | undefined,
  peakKpTonight?: number | null,
  auroraSignal?: AuroraSignal | null,
): string {
  const cards: string[] = [];

  // Aurora card — prefer AuroraWatch UK when available, fall back to Kp index
  const awukLevel = auroraSignal?.nearTerm?.level;
  const awukFresh = auroraSignal?.nearTerm && !auroraSignal.nearTerm.isStale;
  const upcomingCmeCount = auroraSignal?.upcomingCmeCount ?? 0;
  const nextCmeArrival = auroraSignal?.nextCmeArrival;

  if (awukFresh && awukLevel && awukLevel !== 'green') {
    // AuroraWatch UK active alert (yellow/amber/red)
    const meta = AWUK_LEVEL_META[awukLevel] ?? { label: awukLevel, fg: C.warning, bg: C.warningContainer, border: '#EDD17B' };
    const desc = AWUK_LEVEL_DESCRIPTIONS[awukLevel] ?? `AuroraWatch UK status: ${awukLevel}.`;
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Space weather</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">Aurora signal tonight</div>
      <div style="Margin-top:10px;">${pill(`AuroraWatch UK — ${meta.label}`, meta.fg, meta.bg, meta.border)}</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(desc)}</div>
    `));
  } else if (peakKpTonight !== null && peakKpTonight !== undefined && peakKpTonight >= 5) {
    // Fall back to NOAA Kp index when AuroraWatch UK is unavailable or green
    const kpDisplay = peakKpTonight.toFixed(1);
    const visible = peakKpTonight >= 6;
    const fg = visible ? C.success : C.warning;
    const bg = visible ? C.successContainer : C.warningContainer;
    const border = visible ? '#A3D9B1' : '#EDD17B';
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Space weather</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">Aurora signal tonight</div>
      <div style="Margin-top:10px;">${pill(`Kp ${kpDisplay}${visible ? ' — visible ~54°N' : ' — watch threshold'}`, fg, bg, border)}</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">
        ${visible
          ? `Kp ${kpDisplay} exceeds the visibility threshold for Leeds latitude. Best combined with a good astro window.`
          : `Kp ${kpDisplay} is approaching the visible threshold (~Kp 6 at 54°N). Worth watching overnight.`}
      </div>
    `));
  }

  // Long-range CME prediction card (separate from near-term)
  if (upcomingCmeCount > 0 && nextCmeArrival) {
    const arrivalDate = new Date(nextCmeArrival);
    const arrivalStr = isNaN(arrivalDate.getTime())
      ? nextCmeArrival
      : arrivalDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const cmeLabel = upcomingCmeCount === 1 ? 'Earth-directed CME' : `${upcomingCmeCount} Earth-directed CMEs`;
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Aurora prediction</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">CME forecast: ${esc(arrivalStr)}</div>
      <div style="Margin-top:10px;">${pill(`${cmeLabel} — NASA DONKI`, C.warning, C.warningContainer, '#EDD17B')}</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">
        Elevated aurora probability around ${esc(arrivalStr)}. Monitor AuroraWatch UK as arrival approaches. Confidence is moderate — CME trajectory models carry uncertainty.
      </div>
    `));
  }

  if (shSunriseQ !== null || shSunsetQ !== null) {
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Twilight signal</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">SunsetHue outlook</div>
      <div style="Margin-top:10px;">
        ${metricChip('Sunrise', `${shSunriseQ ?? '-'}%`, C.tertiary)}
        ${metricChip('Sunset', `${shSunsetQ ?? '-'}%`, C.tertiary)}
      </div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">
        ${esc(shSunsetText || 'No extra sky-texture note today.')}${sunDir !== null ? ` Sun direction ${Math.round(sunDir!)} degrees.` : ''}${crepPeak > 45 ? ` Rays ${crepPeak}/100.` : ''}
      </div>
    `));
  }
  if (metarNote) {
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Live sky check</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">Current METAR signal</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(metarNote)}</div>
    `));
  }
  return listRows(cards);
}

/** Build a user-facing snow note for an alt location card.
 *  Returns an empty string when there is no snow data or no snow present. */
function buildSnowNote(snowDepthCm: number | null, snowfallCm: number | null): string {
  const parts: string[] = [];
  if (snowDepthCm !== null && snowDepthCm > 0) {
    parts.push(`${snowDepthCm}cm snow on the ground`);
  }
  if (snowfallCm !== null && snowfallCm > 0) {
    parts.push(`${snowfallCm}cm snowfall expected`);
  }
  return parts.join(' · ');
}

function alternativeSection(
  altLocations: AltLocation[] | undefined,
  closeContenders: AltLocation[] | undefined,
  noAltsMsg: string | undefined,
): string {
  if ((!altLocations || !altLocations.length) && (!closeContenders || !closeContenders.length)) {
    return card(`<div style="font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(noAltsMsg || 'No nearby locations score well enough today.')}</div>`);
  }

  const renderGroup = (title: string, locations: AltLocation[]): string => {
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
  };

  const renderCloseContenders = (locations: AltLocation[]): string => {
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
  };

  const astroAlternatives = (altLocations || []).filter(loc => loc.isAstroWin);
  const goldenHourAlternatives = (altLocations || []).filter(loc => !loc.isAstroWin);
  const sections = [
    renderGroup('Nearby astro options', astroAlternatives),
    renderGroup('Nearby landscape options', goldenHourAlternatives),
    renderCloseContenders(closeContenders || []),
  ].filter(Boolean);

  return card(sections.join(`<div style="height:14px;"></div>`));
}

function alternativeSummaryTitle(topAlternative: AltLocation | null | undefined, isCloseContender = false): string {
  if (!topAlternative) return 'Best nearby alternative';
  if (isCloseContender) return 'Nearby darker-sky contender';
  return topAlternative.isAstroWin ? 'Best nearby astro alternative' : 'Best nearby golden-hour alternative';
}

function alternativeTimingSummary(topAlternative: AltLocation | null | undefined): string {
  if (!topAlternative) return '';
  if (topAlternative.isAstroWin) {
    return ` · astro from ${topAlternative.bestAstroHour || 'evening'}`;
  }
  return ` · ${bestDaySessionLabel(topAlternative.bestDayHour).toLowerCase()} around ${topAlternative.bestDayHour || 'time TBD'}`;
}

function displayLongRangeLabel(cardLabel: string | null | undefined): string | null {
  if (!cardLabel) return null;
  return cardLabel === 'Weekend opportunity' ? 'Long-range opportunity' : cardLabel;
}

function departByTime(targetTime: string | null | undefined, driveMins: number): string | null {
  const targetMinutes = clockToMinutes(targetTime);
  if (targetMinutes === null) return null;
  const totalDayMinutes = 24 * 60;
  const departMinutes = ((targetMinutes - driveMins) % totalDayMinutes + totalDayMinutes) % totalDayMinutes;
  return minutesToClock(departMinutes);
}

function longRangeFeasibilityNote(longRangeTop: LongRangeCard): string {
  const targetTime = longRangeTop.isAstroWin ? longRangeTop.bestAstroHour : longRangeTop.bestDayHour;
  const departBy = departByTime(targetTime, longRangeTop.driveMins);

  if (longRangeTop.driveMins >= 180) {
    if (departBy && targetTime) {
      return `Road-trip option - leave by ~${departBy} for the ${targetTime} ${longRangeTop.isAstroWin ? 'astro window' : 'light window'}. Overnight recommended.`;
    }
    return 'Road-trip option - best treated as a dedicated trip rather than a same-day short-notice run.';
  }

  if (longRangeTop.driveMins >= 120) {
    if (departBy && targetTime) {
      return `Long drive - leave by ~${departBy} for the ${targetTime} ${longRangeTop.isAstroWin ? 'astro window' : 'light window'}.`;
    }
    return 'Long drive - better as a planned outing than a casual detour.';
  }

  if (longRangeTop.driveMins >= 90) {
    return 'Long drive - better as a planned outing than a casual detour.';
  }

  return '';
}

function longRangeSection(
  longRangeTop: LongRangeCard | null | undefined,
  cardLabel: string | null | undefined,
  darkSkyAlert: DarkSkyAlertCard | null | undefined,
): string {
  const cards: string[] = [];

  if (longRangeTop && cardLabel) {
    const displayLabel = displayLongRangeLabel(cardLabel) || cardLabel;
    const regionLabel = longRangeTop.region.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const timing = longRangeTop.isAstroWin
      ? `Best astro around ${longRangeTop.bestAstroHour || 'evening'}${longRangeTop.darkSky ? ' - dark sky site' : ''}`
      : `Best at ${longRangeTop.bestDayHour || 'time TBD'} - ${longRangeTop.tags.slice(0, 2).map(tag => displayTag(tag)).join(', ')}`;
    const feasibility = longRangeFeasibilityNote(longRangeTop);
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
      ${feasibility ? `<div style="Margin-top:8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.secondary};">${esc(feasibility)}</div>` : ''}
    `, '', `border-top:3px solid ${C.secondary};`));
  }

  if (darkSkyAlert && (!longRangeTop || darkSkyAlert.name !== longRangeTop?.name)) {
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

function spurOfTheMomentCard(spur: SpurOfTheMomentSuggestion): string {
  const regionLabel = spur.region.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const tagChips = spur.tags
    .slice(0, 3)
    .map(tag => metricChip(displayTag(tag), ''))
    .join('');
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

/* ------------------------------------------------------------------ */
/*  Next-day hourly weather outlook                                    */
/* ------------------------------------------------------------------ */

/** Finds the longest contiguous run of highlighted hours (comfort ≥ 55). */
function bestOutdoorWindow(
  hours: NextDayHour[],
  scored: Array<{ score: number; label: { text: string; highlight: boolean } }>,
): { start: string; end: string; label: string } | null {
  let bestRun: { start: number; end: number } | null = null;
  let currentStart = -1;
  let currentLen = 0;
  let bestLen = 0;

  for (let i = 0; i < hours.length; i++) {
    if (scored[i].label.highlight) {
      if (currentStart === -1) currentStart = i;
      currentLen++;
      if (currentLen > bestLen) {
        bestLen = currentLen;
        bestRun = { start: currentStart, end: i };
      }
    } else {
      currentStart = -1;
      currentLen = 0;
    }
  }

  if (!bestRun) return null;
  const startHour = hours[bestRun.start].hour;
  const endHour = hours[bestRun.end].hour;
  const topLabel = scored.slice(bestRun.start, bestRun.end + 1)
    .reduce((best, h) => h.score > best.score ? h : best)
    .label.text;
  return { start: startHour, end: endHour, label: topLabel };
}

interface HourlyOutlookOptions {
  title: string;
  caption: string;
  summaryContext: 'today' | 'tomorrow';
  startAtMinutes?: number | null;
  showOvernight?: boolean;
  photoWindows?: Window[];
}

/** Plain-language summary line for the outdoor outlook. */
function outdoorSummaryLine(
  bestWindow: { start: string; end: string; label: string } | null,
  hours: NextDayHour[],
  summaryContext: 'today' | 'tomorrow',
): string {
  if (!hours.length) return summaryContext === 'today'
    ? 'No useful outdoor hours remain today.'
    : 'No forecast data available for tomorrow.';
  const dayHours = hours.filter(h => !h.isNight);
  if (!dayHours.length) return summaryContext === 'today'
    ? 'No daytime outdoor hours remain today.'
    : 'No daytime hours in tomorrow\'s forecast.';

  const avgTmp = Math.round(dayHours.reduce((s, h) => s + h.tmp, 0) / dayHours.length);
  const maxPp = Math.max(...dayHours.map(h => h.pp));
  const maxWind = Math.max(...dayHours.map(h => h.wind));

  const rainNote = maxPp > 60 ? 'heavy rain likely' : maxPp > 30 ? 'some rain likely' : maxPp > 10 ? 'chance of showers' : 'mostly dry';
  const windNote = maxWind > 40 ? ' with strong winds' : maxWind > 25 ? ' with breezy spells' : '';
  const capitalizedRain = rainNote.charAt(0).toUpperCase() + rainNote.slice(1);

  if (bestWindow) {
    return summaryContext === 'today'
      ? `${capitalizedRain}${windNote}. Around ${avgTmp}°C. Best remaining outdoor window: ${bestWindow.start}–${bestWindow.end}.`
      : `${capitalizedRain}${windNote}. Around ${avgTmp}°C. Best outdoor window: ${bestWindow.start}–${bestWindow.end}.`;
  }
  return `${capitalizedRain}${windNote}. Around ${avgTmp}°C. Limited outdoor opportunities.`;
}

function shouldDisplayOutdoorHour(hour: NextDayHour, showOvernight: boolean): boolean {
  if (showOvernight) return true;
  const minutes = clockToMinutes(hour.hour) ?? 0;
  return !hour.isNight || (minutes >= 18 * 60 && minutes < 23 * 60);
}

function formatPhotoWindowList(windows: Window[]): string {
  return windows
    .map(window => `${window.label} ${windowRange(window)}`)
    .join(' · ');
}

/** Returns an inline Meteocon SVG for the weather condition, sized at `size` pixels.
 *
 *  IDs within the SVG are prefixed with the condition name to avoid gradient conflicts
 *  when multiple different weather condition SVGs appear in the same HTML document.
 *  The Meteocon production/fill/svg-static icons use simple alphabetic IDs (e.g. "a", "b")
 *  for gradients/symbols, and reference them via url(#id), href="#id", and xlink:href="#id" —
 *  those are the only reference patterns covered here. */
function weatherIconForHour(h: Pick<NextDayHour, 'ct' | 'pp' | 'pr' | 'isNight'>, size = 20): string {
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
  const pfx = `wx-${condition}`;
  const scoped = svg
    .replace(/\bid="([^"]+)"/g, `id="${pfx}-$1"`)
    .replace(/\burl\(#([^)]+)\)/g, `url(#${pfx}-$1)`)
    .replace(/\bhref="#([^"]+)"/g, `href="#${pfx}-$1"`)
    .replace(/\bxlink:href="#([^"]+)"/g, `xlink:href="#${pfx}-$1"`);
  return scoped.replace('<svg ', `<svg data-condition="${condition}" width="${size}" height="${size}" `);
}

/** Returns an inline Meteocon SVG for the moon phase, sized at `size` pixels.
 *
 *  Because only the illumination percentage is available (not whether the moon is waxing or
 *  waning), the waxing-phase icons are used as a visual representative for each brightness band.
 *  The same ID-prefixing strategy as weatherIconForHour is applied so that gradient IDs don't
 *  clash with other SVGs in the same document. */
function moonIconForPct(moonPct: number, size = 14): string {
  let condition: string;
  // Waxing-phase icons represent each brightness band (waxing/waning is indistinguishable from pct alone)
  if (moonPct <= 15) condition = 'moon-new';
  else if (moonPct <= 40) condition = 'moon-waxing-crescent';
  else if (moonPct <= 70) condition = 'moon-first-quarter';
  else if (moonPct <= 90) condition = 'moon-waxing-gibbous';
  else condition = 'moon-full';
  const svg = MOON_ICON_SVGS[condition];
  if (!svg) return '';
  const pfx = `mn-${condition}`;
  const scoped = svg
    .replace(/\bid="([^"]+)"/g, `id="${pfx}-$1"`)
    .replace(/\burl\(#([^)]+)\)/g, `url(#${pfx}-$1)`)
    .replace(/\bhref="#([^"]+)"/g, `href="#${pfx}-$1"`)
    .replace(/\bxlink:href="#([^"]+)"/g, `xlink:href="#${pfx}-$1"`);
  return scoped.replace('<svg ', `<svg width="${size}" height="${size}" style="vertical-align:middle;" `);
}

/** Renders the next-day hourly weather outlook card. */
export function nextDayHourlyOutlookSection(
  tomorrow: DaySummary | undefined,
  debugContext?: DebugContext,
  options: Partial<HourlyOutlookOptions> = {},
): string {
  const config: HourlyOutlookOptions = {
    title: 'Tomorrow at a glance',
    caption: 'Tomorrow&apos;s hourly weather outlook',
    summaryContext: 'tomorrow',
    startAtMinutes: null,
    showOvernight: false,
    photoWindows: [],
    ...options,
  };
  const hours = (tomorrow?.hours || [])
    .filter(hour => config.startAtMinutes === null || config.startAtMinutes === undefined || (clockToMinutes(hour.hour) ?? -1) >= config.startAtMinutes)
    .filter(hour => shouldDisplayOutdoorHour(hour, Boolean(config.showOvernight)));
  if (!hours.length) return '';

  const scoredHours = hours.map(h => {
    const score = outdoorComfortScore(h);
    const label = outdoorComfortLabel(score, h);
    return { h, score, label };
  });

  const dayHoursOnly = hours.filter(h => !h.isNight);
  const dayScored = scoredHours.filter(s => !s.h.isNight);
  const bestWindow = bestOutdoorWindow(dayHoursOnly, dayScored.map(s => ({ score: s.score, label: s.label })));
  const summaryLine = outdoorSummaryLine(bestWindow, hours, config.summaryContext);

  // Populate debug context
  if (debugContext) {
    const debugHours: DebugOutdoorComfortHour[] = scoredHours.filter(({ h }) => !h.isNight).map(({ h, score, label }) => ({
      hour: h.hour,
      comfortScore: score,
      label: label.text,
      tmp: h.tmp,
      pp: h.pp,
      wind: h.wind,
      visK: h.visK,
      pr: h.pr,
    }));
    debugContext.outdoorComfort = { bestWindow, hours: debugHours };
  }

  // Build the hourly rows table
  const hourRows = scoredHours.map(({ h, score, label }) => {
    const rowBg = label.highlight ? label.bg : 'transparent';
    const textColor = label.highlight ? label.fg : C.muted;
    const indicatorDot = label.highlight
      ? `<span style="color:${label.fg};font-size:14px;">&#x25CF;</span>&ensp;`
      : `<span style="color:${C.outline};font-size:14px;">&#x25CB;</span>&ensp;`;
    const reason = outdoorComfortReason(h);
    return `<tr style="background:${rowBg};">
      <td valign="middle" style="padding:6px 8px;font-family:${FONT};font-size:12px;font-weight:600;color:${C.ink};white-space:nowrap;">${esc(h.hour)}</td>
      <td valign="middle" style="padding:6px 4px;text-align:center;white-space:nowrap;">${weatherIconForHour(h)}</td>
      <td valign="middle" style="padding:6px 6px;font-family:${FONT};font-size:12px;color:${C.ink};white-space:nowrap;">${esc(String(Math.round(h.tmp)))}°C</td>
      <td valign="middle" style="padding:6px 6px;font-family:${FONT};font-size:12px;color:${C.ink};white-space:nowrap;">${esc(String(h.pp))}%</td>
      <td valign="middle" style="padding:6px 6px;font-family:${FONT};font-size:12px;color:${C.ink};white-space:nowrap;">${esc(String(h.wind))}km/h</td>
      <td valign="middle" style="padding:6px 8px 6px 6px;font-family:${FONT};font-size:12px;color:${textColor};">${indicatorDot}${esc(label.text)}</td>
      <td valign="middle" style="padding:6px 8px 6px 2px;font-family:${FONT};font-size:11px;color:${C.subtle};white-space:nowrap;">
        <div>${score}/100</div>
        ${reason ? `<div style="font-size:10px;color:${C.subtle};opacity:0.8;">${esc(reason)}</div>` : ''}
      </td>
    </tr>`;
  }).join('');

  const table = `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    <caption style="font-size:0;line-height:0;visibility:hidden;caption-side:top;">${config.caption}</caption>
    <thead>
      <tr>
        <th scope="col" align="left" style="padding:6px 8px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Time</th>
        <th scope="col" align="center" style="padding:6px 4px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Sky</th>
        <th scope="col" align="left" style="padding:6px 6px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Temp</th>
        <th scope="col" align="left" style="padding:6px 6px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Rain</th>
        <th scope="col" align="left" style="padding:6px 6px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Wind</th>
        <th scope="col" align="left" style="padding:6px 8px 6px 6px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Outdoor</th>
        <th scope="col" align="left" style="padding:6px 8px 6px 2px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">Why</th>
      </tr>
    </thead>
    <tbody>${hourRows}</tbody>
  </table>`;
  const photoWindowsLine = config.photoWindows?.length
    ? `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">Next photo windows: ${esc(formatPhotoWindowList(config.photoWindows))}</div>`
    : '';

  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">${config.title}</div>
    <div style="Margin-top:4px;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(summaryLine)}</div>
    ${photoWindowsLine}
    <div style="Margin-top:12px;overflow-x:auto;">${table}</div>
  `);
}

function remainingTodayHourlyOutlookSection(
  today: DaySummary | undefined,
  runTime: RunTimeContext,
  photoWindows: Window[],
  debugContext?: DebugContext,
): string {
  const startAtMinutes = runTime.nowMinutes % 60 === 0
    ? runTime.nowMinutes
    : runTime.nowMinutes + (60 - (runTime.nowMinutes % 60));
  return nextDayHourlyOutlookSection(today, debugContext, {
    title: `Today from ${minutesToClock(startAtMinutes)}`,
    caption: 'Today&apos;s remaining-hours outlook',
    summaryContext: 'today',
    startAtMinutes,
    showOvernight: false,
    photoWindows,
  });
}

function forecastMoonPct(day: DaySummary): number | null {
  const hours = day.hours || [];
  const bestAstroHour = day.bestAstroHour
    ? hours.find(hour => hour.hour === day.bestAstroHour && typeof hour.moon === 'number')
    : null;
  const representativeHour = bestAstroHour
    || hours.find(hour => hour.isNight && typeof hour.moon === 'number')
    || hours.find(hour => typeof hour.moon === 'number')
    || null;
  return typeof representativeHour?.moon === 'number' ? Math.round(representativeHour.moon) : null;
}

function photoForecastCards(dailySummary: DaySummary[]): string {
  const forecastDays = dailySummary.filter(day => day.dayIdx >= 1).slice(0, 4);
  return listRows(forecastDays.map(day => {
    const dayIsAstroLed = (day.astroScore ?? 0) > (day.photoScore ?? 0);
    const { confidence: effConf } = effectiveConf(day, dayIsAstroLed);
    const displayScore = day.headlineScore ?? day.photoScore;
    const bestAltHour = day.bestAlt?.isAstroWin
      ? day.bestAlt.bestAstroHour
      : day.bestAlt?.bestDayHour;
    const scoreStr = typeof displayScore === 'number' ? `${displayScore}/100` : '-';
    const confState = confidenceDetail(effConf);
    const moonPct = forecastMoonPct(day);
    const moonLine = moonPct !== null
      ? `${moonIconForPct(moonPct, 12)} <span style="vertical-align:middle;">Moon ${moonPct}% lit</span>`
      : '';
    const spreadNote = dayIsAstroLed 
      ? (day.astroConfidenceStdDev !== null && day.astroConfidenceStdDev !== undefined ? ` · spread ${day.astroConfidenceStdDev}` : '')
      : (day.confidenceStdDev !== null && day.confidenceStdDev !== undefined ? ` · spread ${day.confidenceStdDev}` : '');
    const confText = confState ? `<span style="color:${confState.fg};">${confState.label}${spreadNote}</span>` : '';

    const altLine = day.bestAlt
      ? `Backup: ${day.bestAlt.name} · ${day.bestAlt.bestScore}/100${bestAltHour ? ` at ${bestAltHour}` : ''}${day.bestAlt.isAstroWin ? ' (astro)' : ''}${typeof day.bestAlt.driveMins === 'number' ? ` · ${day.bestAlt.driveMins} min drive` : ''}`
      : '';

    return card(`
    <div style="font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">${esc(dayHeading(day))} &middot; ${scoreState(displayScore).label} (${scoreStr})</div>
    <div style="Margin-top:8px;font-family:${FONT};font-size:14px;font-weight:600;line-height:1.5;color:${C.ink};">${esc(forecastBestLine(day))}</div>
    <div style="Margin-top:10px;">
      ${metricChip('AM', day.amScore ?? 0, scoreState(day.amScore ?? 0).fg)}
      ${metricChip('PM', day.pmScore ?? 0, scoreState(day.pmScore ?? 0).fg)}
      ${metricChip('Astro', day.astroScore ?? 0, scoreState(day.astroScore ?? 0).fg)}
      ${confText ? `<span style="font-family:${FONT};font-size:11px;font-weight:600;margin-left:4px;">${confText}</span>` : ''}
    </div>
    ${moonLine ? `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.secondary};">${moonLine}</div>` : ''}
    ${altLine ? `<div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(altLine)}</div>` : ''}
    <div style="Margin-top:8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${daylightUtilityLine(day.carWash)}</div>
    `);
  }));
}

function daylightUtilityTodayCard(todayCarWash: CarWash, runTime: RunTimeContext): string {
  const cw = todayCarWash;
  const state = cw.score >= 75
    ? { fg: C.success, bg: C.successContainer, border: '#A3D9B1' }
    : cw.score >= 50
      ? { fg: C.onPrimaryContainer, bg: C.primaryContainer, border: '#A8D4FB' }
      : { fg: C.error, bg: C.errorContainer, border: '#ECACA5' };
  const startMinutes = clockToMinutes(cw.start);
  const endMinutes = clockToMinutes(cw.end);
  const isPast = startMinutes !== null && endMinutes !== null && endMinutes < runTime.nowMinutes;
  const isOngoing = startMinutes !== null && endMinutes !== null && startMinutes <= runTime.nowMinutes && endMinutes >= runTime.nowMinutes;
  const clippedStart = isOngoing
    ? minutesToClock(runTime.nowMinutes % 60 === 0 ? runTime.nowMinutes : runTime.nowMinutes + (60 - (runTime.nowMinutes % 60)))
    : cw.start;
  const window = cw.start !== '\u2014'
    ? `${clippedStart}–${cw.end}`
    : '\u2014';
  const utilityLabel = isPast
    ? 'Earlier daylight utility'
    : isOngoing
      ? 'Daylight utility now'
      : 'Daylight utility';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${C.surfaceVariant};border-radius:10px;">
    <tr>
      <td style="padding:10px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle">
              <span style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:${C.subtle};">${utilityLabel}</span>
              <span style="font-family:${FONT};font-size:13px;font-weight:600;color:${C.ink};margin-left:10px;">${UTILITY_GLYPHS} ${esc(window)}</span>
            </td>
            <td align="right" valign="middle">
              ${pill(`${cw.rating} ${cw.label}`, state.fg, state.bg, state.border)}
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:7px;">
              ${metricChip('Wind', `${cw.wind}km/h`, C.tertiary)}
              ${metricChip('Rain', `${cw.pp}%`, C.error)}
              ${metricChip('Temp', `${cw.tmp}°C`, C.secondary)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function formatEmail(input: FormatEmailInput): string {
  const {
    dontBother,
    windows,
    todayCarWash: todayCarWashData,
    dailySummary,
    altLocations,
    closeContenders,
    noAltsMsg,
    sunriseStr,
    sunsetStr,
    moonPct,
    metarNote,
    today,
    todayBestScore,
    shSunsetQ,
    shSunriseQ,
    shSunsetText,
    sunDir,
    crepPeak,
    aiText,
    compositionBullets,
    weekInsight,
    peakKpTonight,
    auroraSignal,
    longRangeTop,
    longRangeCardLabel,
    darkSkyAlert,
    spurOfTheMoment,
    geminiInspire,
    debugContext,
  } = input;

  /* Hero card */
  const todayDay = dailySummary[0] || ({} as DaySummary);
  const runTime = getRunTimeContext(debugContext);
  const hasLocalWindow = (windows?.length || 0) > 0;
  const effectiveDontBother = dontBother || !hasLocalWindow;
  const displayPlan = buildWindowDisplayPlan(windows, runTime.nowMinutes);
  const topWindow = !effectiveDontBother ? displayPlan.primary : null;
  const heroScore = todayDay.headlineScore ?? todayBestScore;
  const peakLocalHour = effectiveDontBother
    ? null
    : peakHourForWindow(topWindow || undefined) || todayDay.bestPhotoHour;
  const todayScoreState = scoreState(heroScore);
  const topWindowIsAstro = isAstroWindow(topWindow || undefined);
  const { confidence: todayEffConf, stdDev: todayEffStdDev } = effectiveConf(todayDay, topWindowIsAstro);
  const todayConfidence = confidenceDetail(todayEffConf);
  const topPrimaryAlternative = altLocations?.[0] || null;
  const topCloseContender = closeContenders?.[0] || null;
  const topAlternative = topPrimaryAlternative || topCloseContender || todayDay.bestAlt || null;
  const topAlternativeIsCloseContender = !topPrimaryAlternative && !!topCloseContender && topAlternative?.name === topCloseContender.name;
  const topAltDelta = topAlternative && topWindow
    ? topAlternative.bestScore - topWindow.peak
    : 0;
  const astroGap = topWindow
    ? explainAstroScoreGap({ window: topWindow, today: todayDay })
    : null;
  const nextWindow = !effectiveDontBother
    ? displayPlan.remaining.find(window => window !== topWindow) || null
    : null;
  const factStats: SummaryStat[] = [
    { label: 'Sunrise', value: sunriseStr, tone: C.primary },
    { label: 'Sunset', value: sunsetStr, tone: C.primary },
    { label: 'Moon', value: `${moonDescriptor(moonPct)} · ${moonPct}% lit`, tone: C.tertiary },
  ];

  if (todayConfidence) {
    factStats.push({
      label: 'Certainty',
      value: todayEffStdDev !== null && todayEffStdDev !== undefined
        ? `${todayConfidence.label} · spread ${todayEffStdDev} pts`
        : todayConfidence.label,
      tone: todayConfidence.fg,
    });
  }

  const scoreStats: SummaryStat[] = [
    { label: 'AM light', value: `${todayDay.amScore ?? 0}/100`, tone: scoreState(todayDay.amScore ?? 0).fg },
    { label: 'PM light', value: `${todayDay.pmScore ?? 0}/100`, tone: scoreState(todayDay.pmScore ?? 0).fg },
    { label: 'Peak astro', value: `${todayDay.astroScore ?? 0}/100`, tone: scoreState(todayDay.astroScore ?? 0).fg },
    { label: bestTimeLabel(topWindow), value: peakLocalHour || 'No clear slot', tone: C.onPrimaryContainer },
  ];

  const localSummary = effectiveDontBother
    ? (hasLocalWindow
        ? 'Not a great photography day locally — better to enjoy the outdoors instead.'
        : 'No local window cleared the threshold today — treat Leeds as a pass unless you just want a walk.')
    : timeAwareLocalSummary(displayPlan, topWindow, [
      topWindow
        ? `${topWindow.label}: ${windowRange(topWindow)} at ${topWindow.peak}/100.`
        : todayDay.bestTags
          ? `Best local setup: ${todayDay.bestPhotoHour || 'time TBD'} for ${displayBestTags(todayDay.bestTags)}.`
          : todayDay.bestPhotoHour
            ? `Best local setup: ${todayDay.bestPhotoHour}.`
            : '',
      astroGap
        ? astroGap.text
        : '',
      nextWindow && isAstroWindow(topWindow || undefined) && isAstroWindow(nextWindow)
        ? `${nextWindow.label}: ${nextWindow.start}-${nextWindow.end} at ${nextWindow.peak}/100 if you miss the first slot.`
        : '',
    ]);

  const spurMatchesTopAlt =
    !!spurOfTheMoment && !!topAlternative && spurOfTheMoment.locationName === topAlternative.name;

  const altSpurHook = spurMatchesTopAlt ? `\n"${spurOfTheMoment!.hookLine}"` : '';

  const altTimingNote = alternativeTimingSummary(topAlternative);

  const alternativeSummary = topAlternative
    ? `${topAlternative.name} · ${topAlternative.bestScore}/100 · ${topAlternative.driveMins} min drive${altTimingNote}${altSpurHook}`
    : '';

  const heroWindowLabel = topWindow
    ? `${displayPlan.allPast ? '<span style="font-weight:400;color:rgba(255,255,255,0.40);">Earlier today:</span><br>' : ''}${esc(topWindow.label)}<br><span style="font-weight:400;color:rgba(255,255,255,0.45);font-size:12px;">${esc(windowRange(topWindow))}</span>`
    : effectiveDontBother
      ? `<span style="font-weight:400;color:rgba(255,255,255,0.40);">No clear window today</span>`
      : ``;

  const hero = card(`
  <!-- ── Brand header ── -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td valign="middle">
        <span style="color:${C.brand};margin-right:8px;vertical-align:middle;">${BRAND_LOGO}</span><span style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;vertical-align:middle;">Aperture</span>
      </td>
      <td align="right" valign="middle">
        <span style="font-family:${FONT};font-size:12px;font-weight:400;color:rgba(255,255,255,0.38);">Leeds, UK</span>
      </td>
    </tr>
  </table>
  <!-- ── Rule ── -->
  <div style="height:1px;background:rgba(255,255,255,0.10);margin:14px 0 16px;"></div>
  <!-- ── Score + context ── -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="38%" valign="top">
        <div class="hero-score" style="font-family:${FONT};font-size:64px;font-weight:700;line-height:1;letter-spacing:-0.04em;color:${C.brand};">${heroScore}</div>
        <div style="font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-top:4px;">/ 100</div>
      </td>
      <td valign="top" style="padding-left:16px;border-left:1px solid rgba(255,255,255,0.10);">
        <div class="hero-title" style="font-family:${FONT};font-size:17px;font-weight:700;line-height:1.2;letter-spacing:0.02em;text-transform:uppercase;color:#FFFFFF;">${esc(todayScoreState.label)}</div>
        ${heroWindowLabel ? `<div style="font-family:${FONT};font-size:13px;font-weight:600;line-height:1.5;color:rgba(255,255,255,0.70);margin-top:8px;">${heroWindowLabel}</div>` : ''}
        <div style="font-family:${FONT};font-size:11px;color:rgba(255,255,255,0.38);margin-top:10px;">${esc(today)}</div>
      </td>
    </tr>
  </table>
  <!-- ── Rule ── -->
  <div style="height:1px;background:rgba(255,255,255,0.10);margin:16px 0;"></div>
  <!-- ── Stats grids ── -->
  <div style="border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.10);overflow:hidden;">${summaryGrid(factStats, 2)}</div>
  <div style="Margin-top:5px;padding:0 2px;font-family:${FONT};font-size:11px;color:rgba(255,255,255,0.36);">${moonAstroContext(moonPct)}</div>
  <div style="Margin-top:8px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.10);overflow:hidden;">${summaryGrid(scoreStats, 2)}</div>
  ${localSummary || alternativeSummary ? `<div style="height:1px;background:rgba(255,255,255,0.10);margin:14px 0 10px;"></div>` : ''}
  ${localSummary ? `<div style="font-family:${FONT};font-size:12px;line-height:1.55;color:rgba(255,255,255,0.60);">${esc(localSummary.replace(/\n/g, ' · '))}</div>` : ''}
  ${alternativeSummary ? `<div style="font-family:${FONT};font-size:11px;line-height:1.5;color:rgba(255,255,255,0.38);margin-top:5px;">${esc(alternativeSummaryTitle(topAlternative, topAlternativeIsCloseContender))}: ${esc(alternativeSummary)}</div>` : ''}
`, 'hero-card', `background:linear-gradient(160deg, ${C.heroGradientStart} 0%, ${C.heroGradientEnd} 100%);border-color:rgba(255,255,255,0.08);`);

  /* Signal cards */
  const signals = signalCards(shSunriseQ, shSunsetQ, shSunsetText, sunDir, crepPeak, metarNote, peakKpTonight, auroraSignal);

  /* Kit advisory */
  const kitTips = buildKitTips(todayCarWashData, windows, todayDay.astroScore ?? 0, moonPct);
  const kitCard = kitAdvisoryCard(kitTips);

  /* Populate kit advisory trace in debug context */
  if (debugContext) {
    const { trace, tipsShown } = evaluateKitRules(todayCarWashData, windows, todayDay.astroScore ?? 0, moonPct);
    debugContext.kitAdvisory = { rules: trace, tipsShown };
  }

  const tomorrow = dailySummary.find(day => day.dayIdx === 1);
  const remainingPhotoWindows = displayPlan.remaining.filter(window => window !== topWindow);
  const todayOutlookHtml = remainingTodayHourlyOutlookSection(todayDay, runTime, [topWindow, ...remainingPhotoWindows].filter((window): window is Window => Boolean(window)), debugContext);
  const tomorrowOutlookHtml = nextDayHourlyOutlookSection(tomorrow, debugContext);
  const outlookHtml = todayOutlookHtml || tomorrowOutlookHtml;
  const outlookSectionTitle = todayOutlookHtml ? 'Remaining today' : 'Tomorrow\'s weather';
  const longRangeHtml = longRangeSection(longRangeTop, longRangeCardLabel, darkSkyAlert);
  const footerKey = `<div style="padding:12px 4px;border-top:1px solid ${C.outline};font-family:${FONT};font-size:11px;line-height:1.6;color:${C.subtle};">
    <b>Key</b> &middot;
    <b>Score bands</b> Excellent &ge; ${SCORE_THRESHOLDS.excellent} &middot; Good ${SCORE_THRESHOLDS.good}&ndash;${SCORE_THRESHOLDS.excellent - 1} &middot; Marginal ${SCORE_THRESHOLDS.marginal}&ndash;${SCORE_THRESHOLDS.good - 1} &middot; Poor &lt; ${SCORE_THRESHOLDS.marginal} &middot;
    AM/PM = sunrise &amp; sunset light quality &middot;
    Astro = night sky potential (clear skies + dark moon) &middot;
    Outdoor comfort = walk/run practicality, independent of photography scoring &middot;
    Crepuscular rays = shafts of light through broken cloud near the horizon &middot;
    Spread = how much forecast models disagree (lower is more reliable) &middot;
    Certainty bands = High &lt; 12 pts &middot; Fair 12&ndash;24 pts &middot; Low &ge; 25 pts &middot;
    Daylight spread = based on golden-hour ensemble &middot; Astro spread = based on night-hour ensemble
  </div>`;

  const sections: string[] = [
    `<tr><td>${hero}</td></tr>`,
    spacer(8),
    `<tr><td>${daylightUtilityTodayCard(todayCarWashData, runTime)}</td></tr>`,
  ];

  if (signals) {
    sections.push(spacer(8), `<tr><td>${signals}</td></tr>`);
  }

  if (!effectiveDontBother) {
    sections.push(
      spacer(16),
      `<tr><td>${sectionTitle('Today\'s window')}</td></tr>`,
      `<tr><td>${todayWindowSection(effectiveDontBother, todayBestScore, aiText, windows, dailySummary, altLocations, runTime, peakKpTonight, compositionBullets)}</td></tr>`,
    );
  }

  if (geminiInspire) {
    sections.push(spacer(8), `<tr><td>${creativeSpark(geminiInspire)}</td></tr>`);
  }

  if (kitCard) {
    sections.push(spacer(8), `<tr><td>${kitCard}</td></tr>`);
  }

  if (altLocations?.length || closeContenders?.length || longRangeTop) {
    sections.push(
      spacer(16),
      `<tr><td>${sectionTitle('Out of town options')}</td></tr>`,
      `<tr><td>${alternativeSection(altLocations, closeContenders, noAltsMsg)}</td></tr>`,
    );

    if (longRangeHtml) {
      sections.push(spacer(12), `<tr><td>${longRangeHtml}</td></tr>`);
    }
  }

  if (outlookHtml) {
    sections.push(
      spacer(16),
      `<tr><td>${sectionTitle(outlookSectionTitle)}</td></tr>`,
      `<tr><td>${outlookHtml}</td></tr>`,
    );
  }

  sections.push(spacer(16), `<tr><td>${sectionTitle('Days ahead')}</td></tr>`);

  if (weekInsight) {
    sections.push(
      `<tr><td>${card(`<div style="font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(weekInsight)}</div>`, '', `border-left:3px solid ${C.tertiary};`)}</td></tr>`,
      spacer(8),
    );
  }

  sections.push(`<tr><td>${photoForecastCards(dailySummary)}</td></tr>`);

  if (spurOfTheMoment && !spurMatchesTopAlt) {
    sections.push(
      spacer(16),
      `<tr><td>${sectionTitle('Spur of the moment')}</td></tr>`,
      `<tr><td>${spurOfTheMomentCard(spurOfTheMoment)}</td></tr>`,
    );
  }

  sections.push(spacer(16), `<tr><td>${footerKey}</td></tr>`);

  return renderMainEmailDocument(sections.join(''));
}

function debugCard(title: string, body: string): string {
  return card(
    `<div style="font-family:${FONT};font-size:14px;font-weight:600;line-height:1.3;color:${C.ink};Margin:0 0 10px;">${esc(title)}</div>${body}`,
    '',
    'border-left:3px solid #A8D4FB;',
  );
}

function debugTable(headers: string[], rows: string[][], emptyMessage = 'No data recorded for this run.'): string {
  if (!rows.length) {
    return `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">${esc(emptyMessage)}</div>`;
  }

  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        ${headers.map(header => `<th scope="col" align="left" style="padding:6px 8px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;line-height:1.3;color:${C.muted};text-transform:uppercase;">${esc(header)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows.map(row => `<tr>${row.map(cell => `<td valign="top" style="padding:7px 8px;border-bottom:1px solid ${C.surfaceVariant};font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">${cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>`;
}

function debugKeyValueLines(items: Array<[string, string | number | null | undefined]>): string {
  return items
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `<div style="font-family:${FONT};font-size:12px;line-height:1.6;color:${C.ink};"><span style="font-weight:600;color:${C.onPrimaryContainer};">${esc(label)}:</span> ${esc(value)}</div>`)
    .join('');
}

export function formatDebugEmail(debugContext: DebugContext): string {
  const metadata = debugContext.metadata;
  const scores = debugContext.scores;
  const hourlyRows = debugContext.hourlyScoring.map(hour => ([
    esc(hour.hour),
    esc(String(hour.final)),
    esc(`${hour.cloud}%`),
    esc(`${hour.visK}km`),
    esc(String(hour.aod)),
    esc(`${hour.moon.altitudeDeg}° / ${hour.moon.illuminationPct}%`),
    esc(hour.moonState),
    esc(String(hour.moonAdjustment)),
    esc(String(hour.aodPenalty)),
    esc(`${hour.astroScore}`),
  ]));
  const showDarkPhaseColumn = debugContext.windows.some(window => Boolean(window.darkPhaseStart));
  const windowRows = debugContext.windows.map(window => {
    const row = [
      esc(`#${window.rank}`),
      esc(window.label),
      esc(`${window.start}-${window.end}`),
      esc(String(window.peak)),
      esc(window.selected ? 'Yes' : 'No'),
      esc(window.selectionReason),
    ];
    if (showDarkPhaseColumn) {
      row.push(esc(window.darkPhaseStart ? `Dark after ${window.darkPhaseStart}${window.postMoonsetScore !== null && window.postMoonsetScore !== undefined ? ` (${window.postMoonsetScore}/100)` : ''}` : '—'));
    }
    return row;
  });
  const altRows = debugContext.nearbyAlternatives.map(alt => ([
    esc(`#${alt.rank}`),
    esc(alt.name),
    esc(String(alt.bestScore)),
    esc(`${alt.driveMins}m`),
    esc(`B${alt.bortle}`),
    esc(alt.darknessDelta >= 0 ? `+${alt.darknessDelta}` : `${alt.darknessDelta}`),
    esc(alt.weatherDelta >= 0 ? `+${alt.weatherDelta}` : `${alt.weatherDelta}`),
    esc(alt.deltaVsWindowPeak !== null && alt.deltaVsWindowPeak !== undefined
      ? (alt.deltaVsWindowPeak >= 0 ? `+${alt.deltaVsWindowPeak}` : `${alt.deltaVsWindowPeak}`)
      : '—'),
    esc(alt.shown ? 'Shown' : alt.discardedReason || 'Hidden'),
  ]));

  const longRangeRows = (debugContext.longRangeCandidates || []).map(c => ([
    esc(`#${c.rank}`),
    esc(c.name),
    esc(c.region),
    esc(String(c.bestScore)),
    esc(String(c.dayScore)),
    esc(String(c.astroScore)),
    esc(c.deltaVsLeeds >= 0 ? `+${c.deltaVsLeeds}` : `${c.deltaVsLeeds}`),
    esc(c.darkSky ? 'Yes' : 'No'),
    esc(c.shown ? 'Shown' : c.discardedReason || 'Eligible pool candidate'),
  ]));

  const kitRows = (debugContext.kitAdvisory?.rules || []).map(rule => ([
    esc(rule.id),
    esc(rule.threshold),
    esc(rule.value),
    rule.matched
      ? `<span style="color:${C.success};font-weight:700;">Yes ✓</span>`
      : `<span style="color:${C.muted};">No</span>`,
    rule.shown
      ? `<span style="color:${C.success};font-weight:700;">Shown</span>`
      : `<span style="color:${C.muted};">Hidden</span>`,
  ]));

  const aiTrace = debugContext.ai;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Photo Brief Debug</title>
</head>
<body style="margin:0;padding:16px;background:${C.page};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td>
        ${debugCard('Run metadata', debugKeyValueLines([
          ['Generated at', metadata?.generatedAt],
          ['Location', metadata?.location],
          ['Lat / lon', metadata ? `${metadata.latitude}, ${metadata.longitude}` : null],
          ['Timezone', metadata?.timezone],
          ['Workflow version', metadata?.workflowVersion || null],
          ['Debug mode', metadata ? `${metadata.debugModeEnabled ? 'enabled' : 'disabled'}${metadata.debugModeSource ? ` (${metadata.debugModeSource})` : ''}` : null],
          ['Debug recipient', metadata?.debugRecipient || null],
        ]))}
        ${spacer(8)}
        ${debugCard('Day scores and certainty', debugKeyValueLines([
          ['AM', scores ? `${scores.am}/100` : null],
          ['PM', scores ? `${scores.pm}/100` : null],
          ['Astro', scores ? `${scores.astro}/100` : null],
          ['Overall', scores ? `${scores.overall}/100` : null],
          ['Certainty (daylight)', scores?.certainty || null],
          ['Spread (daylight)', scores?.certaintySpread !== null && scores?.certaintySpread !== undefined ? `${scores.certaintySpread} pts` : null],
          ['Certainty (astro)', scores?.astroConfidence && scores.astroConfidence !== 'unknown' ? scores.astroConfidence : null],
          ['Spread (astro)', scores?.astroConfidenceStdDev !== null && scores?.astroConfidenceStdDev !== undefined ? `${scores.astroConfidenceStdDev} pts` : null],
        ]))}
        ${spacer(8)}
        ${debugCard('Window selection trace', debugTable(
          showDarkPhaseColumn
            ? ['Rank', 'Window', 'Range', 'Peak', 'Selected', 'Reason', 'Dark phase']
            : ['Rank', 'Window', 'Range', 'Peak', 'Selected', 'Reason'],
          windowRows,
          'No local window cleared threshold for this run.',
        ))}
        ${spacer(8)}
        ${debugCard('Hourly astro scoring', debugTable(
          ['Hour', 'Final', 'Cloud', 'Vis', 'AOD', 'Moon', 'Moon state', 'Moon score', 'AOD pen', 'Astro'],
          hourlyRows,
        ))}
        ${spacer(8)}
        ${debugCard('Nearby alternatives', debugTable(
          ['Rank', 'Location', 'Score', 'Drive', 'Bortle', 'Dark Δ', 'Δ vs Leeds', 'Δ vs window', 'Outcome'],
          altRows,
        ))}
        ${spacer(8)}
        ${debugCard('Long-range pool', longRangeRows.length
          ? debugTable(
              ['Rank', 'Location', 'Region', 'Best', 'Day', 'Astro', 'Δ vs Leeds', 'Dark sky', 'Outcome'],
              longRangeRows,
            )
          : `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">No long-range candidates met the threshold this run.</div>`
        )}
        ${aiTrace ? `${spacer(8)}${debugCard('AI editorial trace', `
          ${debugKeyValueLines([
            ['Primary provider', aiTrace.primaryProvider || null],
            ['Selected provider', aiTrace.selectedProvider || null],
            ['Factual check', aiTrace.factualCheck.passed ? 'Passed' : `Failed (${aiTrace.factualCheck.rulesTriggered.join(', ')})`],
            ['Editorial check', aiTrace.editorialCheck.passed ? 'Passed' : `Failed (${aiTrace.editorialCheck.rulesTriggered.join(', ')})`],
            ['Fallback used', aiTrace.fallbackUsed ? 'Yes' : 'No'],
            ['Spur suggestion', aiTrace.spurSuggestion.raw ? `${aiTrace.spurSuggestion.raw}${aiTrace.spurSuggestion.dropped ? ` → dropped: ${aiTrace.spurSuggestion.dropReason || 'no reason recorded'}` : ' → shown'}` : 'None'],
            ['Resolved spur', aiTrace.spurSuggestion.resolved || null],
            ['weekStandout', (() => {
              const ws = aiTrace.weekStandout;
              if (ws.parseStatus === 'parse-failure') return '⚠️ parse failure (fenced/malformed JSON) — dropped [ALERT]';
              if (ws.parseStatus === 'absent' && ws.finalValue) {
                return `absent from raw response → fallback used: "${ws.finalValue}"`;
              }
              if (ws.parseStatus === 'absent') return 'absent from raw response — model did not generate';
              if (ws.decision === 'fallback-used') {
                return `present in raw response → replaced with fallback: "${ws.finalValue || ''}"${ws.fallbackReason ? ` (${ws.fallbackReason})` : ''}`;
              }
              if (!ws.used) return `present in raw response (empty string) — not used`;
              return `present in raw response → used: "${ws.rawValue}"`;
            })()],
          ])}
          <div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Raw Groq response</div>
          <pre style="Margin:6px 0 0;padding:10px;background:${C.surfaceVariant};border:1px solid ${C.outline};border-radius:8px;white-space:pre-wrap;font-family:${MONO};font-size:11px;line-height:1.45;color:${C.ink};">${esc(aiTrace.rawGroqResponse || '(empty)')}</pre>
          ${aiTrace.rawGeminiResponse ? `<div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Raw Gemini response</div>
          <pre style="Margin:6px 0 0;padding:10px;background:${C.surfaceVariant};border:1px solid ${C.outline};border-radius:8px;white-space:pre-wrap;font-family:${MONO};font-size:11px;line-height:1.45;color:${C.ink};">${esc(aiTrace.rawGeminiResponse)}</pre>` : ''}
          <div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Normalized AI text</div>
          <div style="Margin-top:4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">${esc(aiTrace.normalizedAiText || '(empty)')}</div>
          <div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Final AI text</div>
          <div style="Margin-top:4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">${esc(aiTrace.finalAiText || '(empty)')}</div>
        `)}` : ''}
        ${spacer(8)}
        ${debugCard('Kit advisory rule trace', kitRows.length
          ? `${debugTable(
              ['Rule', 'Threshold', 'Value', 'Matched?', 'Shown?'],
              kitRows,
            )}${debugContext.kitAdvisory?.tipsShown?.length
              ? `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};"><span style="font-weight:700;color:${C.onPrimaryContainer};">Tips shown:</span> ${esc(debugContext.kitAdvisory.tipsShown.join(', '))}</div>`
              : `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">No tips shown — no rules matched.</div>`
            }`
          : `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">Kit advisory data not available for this run — ensure debugContext is passed into formatEmail.</div>`
        )}
        ${(() => {
          const oc = debugContext.outdoorComfort;
          if (!oc) return `${spacer(8)}${debugCard('Outdoor comfort window trace', `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">No outdoor comfort data — tomorrow\'s hourly data may be absent.</div>`)}`;
          const ocRows = oc.hours.map(h => ([
            esc(h.hour),
            esc(`${h.tmp}°C`),
            esc(`${h.pp}%`),
            esc(`${h.wind}km/h`),
            esc(`${h.visK}km`),
            esc(`${h.pr}mm`),
            esc(String(h.comfortScore)),
            esc(h.label),
          ]));
          const windowLine = oc.bestWindow
            ? `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};"><span style="font-weight:700;color:${C.onPrimaryContainer};">Best window:</span> ${esc(oc.bestWindow.start)}–${esc(oc.bestWindow.end)} (${esc(oc.bestWindow.label)})</div>`
            : `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">No highlighted outdoor window found.</div>`;
          return `${spacer(8)}${debugCard('Outdoor comfort window trace', `${debugTable(['Hour', 'Temp', 'Rain', 'Wind', 'Vis', 'Precip', 'Score', 'Label'], ocRows)}${windowLine}`)}`;
        })()}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
