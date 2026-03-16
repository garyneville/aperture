import { explainAstroScoreGap } from './astro-score-explanation.js';
import { esc } from './utils.js';
import type { DebugContext } from './debug-context.js';
import { renderAiBriefingText } from './ai-briefing.js';

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
}

export interface FormatEmailInput {
  dontBother: boolean;
  windows: Window[];
  todayCarWash: CarWash;
  dailySummary: DaySummary[];
  altLocations: AltLocation[];
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
  longRangeTop?: LongRangeCard | null;
  longRangeCardLabel?: string | null;
  darkSkyAlert?: DarkSkyAlertCard | null;
  spurOfTheMoment?: SpurOfTheMomentSuggestion | null;
}

export interface LongRangeCard {
  name: string;
  region: string;
  driveMins: number;
  bestScore: number;
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
/*  Material Design 3 colour system                                    */
/* ------------------------------------------------------------------ */

const C = {
  page: '#F7F8FC',
  surface: '#FFFFFF',
  surfaceVariant: '#EEF2F7',
  outline: '#D2D8E2',
  ink: '#171C24',
  muted: '#5F6877',
  subtle: '#7C8799',
  primary: '#3559A8',
  primaryContainer: '#DEE7FF',
  onPrimaryContainer: '#102A5C',
  secondary: '#246B6A',
  secondaryContainer: '#D7F2EF',
  tertiary: '#8A5B00',
  tertiaryContainer: '#FFE2B8',
  warning: '#7A5A00',
  warningContainer: '#FFF0CE',
  success: '#1C5E42',
  successContainer: '#D8F3E6',
  error: '#B3261E',
  errorContainer: '#F9DEDC',
  shadow: 'rgba(30, 44, 63, 0.08)',
};

const FONT = "Roboto, 'Noto Sans', 'Segoe UI', Helvetica, Arial, sans-serif";
const UTILITY_GLYPHS = '<span aria-hidden="true">&#x1F697; / &#x1F6B6;</span>';

/* ------------------------------------------------------------------ */
/*  HTML builder helpers                                               */
/* ------------------------------------------------------------------ */

function htmlText(text: string): string {
  const safe = esc(text || '');
  return safe
    .split(/\n{2,}/)
    .map(chunk => `<p style="Margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};">${chunk.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function scoreState(score: number): { label: string; fg: string; bg: string; border: string } {
  if (score >= 75) return { label: 'Excellent', fg: C.success, bg: C.successContainer, border: '#B7E0CF' };
  if (score >= 58) return { label: 'Good', fg: C.primary, bg: C.primaryContainer, border: '#C5D6FF' };
  if (score >= 42) return { label: 'Marginal', fg: C.warning, bg: C.warningContainer, border: '#F0D58D' };
  return { label: 'Poor', fg: C.error, bg: C.errorContainer, border: '#E8B8B4' };
}

function confidenceDetail(confidence: string | undefined | null): { label: string; fg: string; bg: string; border: string } | null {
  if (!confidence || confidence === 'unknown') return null;
  if (confidence === 'high') {
    return { label: 'High certainty', fg: C.success, bg: C.successContainer, border: '#B7E0CF' };
  }
  if (confidence === 'medium') {
    return { label: 'Fair certainty', fg: C.warning, bg: C.warningContainer, border: '#F0D58D' };
  }
  return { label: 'Low certainty', fg: C.error, bg: C.errorContainer, border: '#E8B8B4' };
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
  return `<span class="pill" style="display:inline-block;padding:4px 10px;border-radius:10px;background:${bg};border:1px solid ${border};font-family:${FONT};font-size:12px;font-weight:700;line-height:1.2;color:${fg};">${esc(text)}</span>`;
}

function metricChip(label: string, value: string | number, tone?: string): string {
  const toneColor = tone || C.primary;
  return `<span class="chip" style="display:inline-block;margin:2px 4px 0 0;padding:3px 7px;border-radius:8px;background:${C.surfaceVariant};border:1px solid ${C.outline};font-family:${FONT};font-size:11px;line-height:1.25;color:${C.ink};"><span style="font-weight:700;color:${toneColor};">${esc(label)}</span> ${esc(value)}</span>`;
}

function metricRun(items: Array<{ label: string; value: string | number; tone?: string }>): string {
  return items
    .map(item => `<span style="display:inline;color:${C.ink};"><span style="font-weight:700;color:${item.tone || C.primary};">${esc(item.label)}</span> ${esc(item.value)}</span>`)
    .join(`<span style="color:${C.subtle};"> &middot; </span>`);
}

function daylightUtilityLine(cw: CarWash): string {
  const utilityWindow = cw.start !== '\u2014' ? `${cw.start}-${cw.end}` : '\u2014';
  return `${UTILITY_GLYPHS} Daylight utility: ${esc(utilityWindow)} <span style="color:${C.subtle};">&middot;</span> Wind ${esc(String(cw.wind))}km/h <span style="color:${C.subtle};">&middot;</span> Rain ${esc(String(cw.pp))}% <span style="color:${C.subtle};">&middot;</span> Temp ${esc(String(cw.tmp ?? '-'))}C`;
}

function moonDescriptor(moonPct: number): string {
  if (moonPct <= 5) return 'New-ish';
  if (moonPct <= 35) return 'Crescent';
  if (moonPct <= 65) return 'Half moon';
  if (moonPct <= 90) return 'Gibbous';
  return 'Full-ish';
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
          <td valign="top" style="width:${100 / columns}%;padding:0;${itemIndex > 0 ? `border-left:1px solid rgba(16,42,92,0.12);` : ''}">
            <div style="padding:9px 10px;">
              <div style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.onPrimaryContainer};opacity:0.7;">${esc(item.label)}</div>
              <div style="Margin-top:4px;font-family:${FONT};font-size:15px;font-weight:700;line-height:1.25;color:${item.tone || C.onPrimaryContainer};">${esc(item.value)}</div>
            </div>
          </td>
        `).join('')}
        ${row.length < columns ? `<td style="width:${100 / columns}%;padding:0;border-left:1px solid rgba(16,42,92,0.12);">&nbsp;</td>`.repeat(columns - row.length) : ''}
      </tr>
    `).join('')}
  </table>`;
}

function summaryNote(label: string, value: string): string {
  const content = esc(value).replace(/\n/g, '<br>');
  return `<div style="Margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.55);border:1px solid rgba(16,42,92,0.12);">
    <div style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.onPrimaryContainer};opacity:0.72;">${esc(label)}</div>
    <div style="Margin-top:4px;font-family:${FONT};font-size:13px;line-height:1.45;color:${C.onPrimaryContainer};">${content}</div>
  </div>`;
}

function spacer(size: number): string {
  return `<tr><td style="height:${size}px;line-height:${size}px;font-size:${size}px;">&nbsp;</td></tr>`;
}

function card(inner: string, extraClass = '', extraStyle = ''): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card ${extraClass}" style="width:100%;border-collapse:separate;background:${C.surface};border:1px solid ${C.outline};border-radius:14px;box-shadow:0 2px 8px ${C.shadow};${extraStyle}">
    <tr>
      <td class="card-pad" style="padding:12px 12px;">
        ${inner}
      </td>
    </tr>
  </table>`;
}

function sectionTitle(title: string): string {
  return `<div style="padding:0 2px 6px 2px;">
    <div class="section-title" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:700;line-height:1.2;color:${C.ink};">${esc(title)}</div>
  </div>`;
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

function scorePill(score: number): string {
  const state = scoreState(score);
  return pill(`${state.label} - ${score}/100`, state.fg, state.bg, state.border);
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

function peakTimeNote(window: Window | null | undefined, peakHour: string | undefined): string {
  if (!window || !peakHour) return '';
  if (window.start === window.end) return '';
  if (peakHour === window.end) return `Best time: ${peakHour}, near the end of the window.`;
  if (peakHour === window.start) return `Best time: ${peakHour}, right as the window opens.`;
  return `Best time: ${peakHour}, within the window.`;
}

function displayBestTags(bestTags: string | undefined, fallback = 'mixed conditions'): string {
  if (!bestTags) return fallback;
  const visibleTags = bestTags
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag && tag !== 'general' && tag !== 'poor');
  return visibleTags.join(', ') || fallback;
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
      return 'High atmospheric moisture: risk of lens fogging - let glass acclimatise before shooting.';
    default:
      return '';
  }
}

export function buildKitTips(
  todayCarWash: CarWash,
  windows: Window[],
  astroScore: number,
  moonPct: number,
  maxTips = 3,
): KitTip[] {
  const topWindow = windows?.[0];
  const topPeakHour = peakWindowHour(topWindow);
  const astroWindow = bestAstroWindow(windows || []);
  const astroPeakHour = peakWindowHour(astroWindow);
  const resolvedAstroScore = Math.max(
    astroScore || 0,
    astroWindowSignal(astroWindow),
  );

  const params = {
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

  return KIT_RULES
    .filter(rule => rule.predicate(params))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxTips)
    .map(rule => ({ id: rule.id, text: buildKitTipText(rule.id, params), priority: rule.priority }));
}

function kitAdvisoryCard(tips: KitTip[]): string {
  if (!tips.length) return '';
  const items = tips.map(tip =>
    `<div style="Margin-bottom:4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">&#x2022; ${esc(tip.text)}</div>`
  ).join('');
  return card(`
    <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">Kit advisory</div>
    <div style="Margin-top:4px;">${items}</div>
  `, '', `border-left:4px solid ${C.tertiary};`);
}

function windowCard(w: Window, index: number, windows: Window[]): string {
  const h = w.hours?.find(x => x.score === w.peak) || w.hours?.[0] || {} as WindowHour;
  const notes: string[] = [];
  const topWindow = windows[0];
  if (w.fallback) notes.push('Most promising narrow stretch rather than a clean standout window.');
  if ((h.crepuscular || 0) > 45) notes.push(`Crepuscular ray potential: ${h.crepuscular}/100 (light shafts through broken cloud).`);
  if (w.darkPhaseStart && w.postMoonsetScore !== null && w.postMoonsetScore !== undefined) {
    notes.push(`Dark from ${w.darkPhaseStart} - peak after moonset ${w.postMoonsetScore}/100.`);
  }
  if (index > 0 && isAstroWindow(topWindow) && isAstroWindow(w) && topWindow?.label !== w.label) {
    notes.push('Later, darker backup if you miss the first astro slot.');
  }
  const metricLine = metricRun([
    { label: 'Cloud high', value: `${h.ch ?? '-'}%`, tone: C.primary },
    { label: 'Visibility', value: `${h.visK ?? '-'}km`, tone: C.secondary },
    { label: 'Wind', value: `${h.wind ?? '-'}km/h`, tone: C.tertiary },
    { label: 'Rain', value: `${h.pp ?? '-'}%`, tone: C.error },
    ...(h.tpw ? [{ label: 'Moisture', value: `${h.tpw}mm`, tone: C.primary }] : []),
  ]);
  const tags = (w.tops || []).length
    ? `<div style="Margin-top:8px;">${(w.tops || []).map(tag => metricChip(tag, '', C.primary)).join('')}</div>`
    : '';
  const noteBlock = notes.length
    ? `<div style="Margin-top:8px;padding-top:14px;border-top:1px solid ${C.outline};font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">${esc(notes.join(' '))}</div>`
    : '';
  return card(`
    <div style="Margin:0 0 3px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">${index === 0 ? 'Best window' : 'Worth watching'}</div>
    <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:700;line-height:1.24;color:${C.ink};">${esc(w.label)}</div>
    <div style="Margin:4px 0 0;font-family:${FONT};font-size:13px;line-height:1.4;color:${C.muted};">${esc(windowRange(w))}</div>
    <div style="Margin-top:8px;">${scorePill(w.peak)}</div>
    <div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">${metricLine}</div>
    ${tags}
    ${noteBlock}
  `, '', index === 0 ? `border-top:4px solid ${scoreState(w.peak).fg};` : '');
}

function compositionCard(bullets: string[]): string {
  if (!bullets.length) return '';
  const items = bullets.map(b =>
    `<div style="Margin-bottom:4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">&#x2022; ${esc(b)}</div>`
  ).join('');
  return card(`
    <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">Shot ideas</div>
    <div style="Margin-top:4px;">${items}</div>
  `, '', `border-left:4px solid ${C.secondary};`);
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
  compositionBullets?: string[],
): string {
  if (dontBother) {
    return card(`
      <div style="Margin:0 0 3px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.error};">Today&apos;s call</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:700;line-height:1.24;color:${C.ink};">Not worth shooting locally</div>
      <div style="Margin-top:8px;">${scorePill(todayBestScore)}</div>
      <div style="Margin-top:8px;font-family:${FONT};font-size:13px;line-height:1.45;color:${C.muted};">${esc(poorDayFallbackLine(windows))}</div>
    `, '', `border-top:4px solid ${C.error};`);
  }
  const renderedAi = renderAiBriefingText(aiText, { dontBother, windows, dailySummary, altLocations });
  const trimmedAiText = renderedAi.text || aiText;
  const compCard = compositionCard(compositionBullets || []);
  return listRows([
    ...(windows || []).map((w, index) => windowCard(w, index, windows || [])),
    card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">AI briefing</div>
      ${htmlText(trimmedAiText)}
    `, '', `border-left:4px solid ${C.primary};`),
    ...(compCard ? [compCard] : []),
  ]);
}

function signalCards(
  shSunriseQ: number | null,
  shSunsetQ: number | null,
  shSunsetText: string | undefined,
  sunDir: number | null,
  crepPeak: number,
  metarNote: string | undefined,
  peakKpTonight?: number | null,
): string {
  const cards: string[] = [];
  if (peakKpTonight !== null && peakKpTonight !== undefined && peakKpTonight >= 5) {
    const kpDisplay = peakKpTonight.toFixed(1);
    const visible = peakKpTonight >= 6;
    const fg = visible ? C.success : C.warning;
    const bg = visible ? C.successContainer : C.warningContainer;
    const border = visible ? '#B7E0CF' : '#F0D58D';
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">Space weather</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.24;color:${C.ink};">Aurora signal tonight</div>
      <div style="Margin-top:8px;">${pill(`Kp ${kpDisplay}${visible ? ' — visible ~54°N' : ' — watch threshold'}`, fg, bg, border)}</div>
      <div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">
        ${visible
          ? `Kp ${kpDisplay} exceeds the visibility threshold for Leeds latitude. Best combined with a good astro window.`
          : `Kp ${kpDisplay} is approaching the visible threshold (~Kp 6 at 54°N). Worth watching overnight.`}
      </div>
    `));
  }
  if (shSunriseQ !== null || shSunsetQ !== null) {
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">Twilight signal</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.24;color:${C.ink};">SunsetHue outlook</div>
      <div style="Margin-top:8px;">
        ${metricChip('Sunrise', `${shSunriseQ ?? '-'}%`, C.tertiary)}
        ${metricChip('Sunset', `${shSunsetQ ?? '-'}%`, C.tertiary)}
      </div>
      <div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">
        ${esc(shSunsetText || 'No extra sky-texture note today.')}${sunDir !== null ? ` Sun direction ${Math.round(sunDir!)} degrees.` : ''}${crepPeak > 45 ? ` Rays ${crepPeak}/100.` : ''}
      </div>
    `));
  }
  if (metarNote) {
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">Live sky check</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.24;color:${C.ink};">Current METAR signal</div>
      <div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">${esc(metarNote)}</div>
    `));
  }
  return listRows(cards);
}

function alternativeSection(
  altLocations: AltLocation[] | undefined,
  noAltsMsg: string | undefined,
): string {
  if (!altLocations || !altLocations.length) {
    return card(`<div style="font-family:${FONT};font-size:13px;line-height:1.45;color:${C.muted};">${esc(noAltsMsg || 'No nearby locations score well enough today.')}</div>`);
  }

  const rows = altLocations.map((loc, index) => {
    const note = loc.isAstroWin
      ? `Astro${loc.darkSky ? ' - dark sky' : ''} - best ${loc.bestAstroHour || 'evening'} - ${loc.driveMins} min drive`
      : `${(loc.types || []).slice(0, 2).join(', ')} - best ${loc.bestDayHour || 'time TBD'} - ${loc.driveMins} min drive`;
    return `<div style="${index < altLocations.length - 1 ? `padding:0 0 8px;border-bottom:1px solid ${C.outline};margin-bottom:8px;` : ''}">
      <div style="font-family:${FONT};font-size:16px;font-weight:700;line-height:1.3;color:${C.ink};">${esc(loc.name)}</div>
      <div style="Margin-top:6px;">${scorePill(loc.bestScore)}</div>
      <div style="Margin-top:6px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">${esc(note)}</div>
    </div>`;
  }).join('');

  return card(rows);
}

function longRangeSection(
  longRangeTop: LongRangeCard | null | undefined,
  cardLabel: string | null | undefined,
  darkSkyAlert: DarkSkyAlertCard | null | undefined,
): string {
  const cards: string[] = [];

  if (longRangeTop && cardLabel) {
    const regionLabel = longRangeTop.region.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const timing = longRangeTop.isAstroWin
      ? `Best astro around ${longRangeTop.bestAstroHour || 'evening'}${longRangeTop.darkSky ? ' - dark sky site' : ''}`
      : `Best at ${longRangeTop.bestDayHour || 'time TBD'} - ${longRangeTop.tags.slice(0, 2).join(', ')}`;
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">${esc(cardLabel)}</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:700;line-height:1.24;color:${C.ink};">${esc(longRangeTop.name)}</div>
      <div style="Margin-top:4px;font-family:${FONT};font-size:13px;line-height:1.4;color:${C.muted};">${esc(regionLabel)} &middot; ${longRangeTop.elevation}m &middot; ${longRangeTop.driveMins} min drive</div>
      <div style="Margin-top:8px;">${scorePill(longRangeTop.bestScore)}</div>
      <div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">${esc(timing)}</div>
    `, '', `border-top:4px solid ${C.secondary};`));
  }

  if (darkSkyAlert && (!longRangeTop || darkSkyAlert.name !== longRangeTop?.name)) {
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">Dark sky alert</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.24;color:${C.ink};">${esc(darkSkyAlert.name)}</div>
      <div style="Margin-top:8px;">${pill(`Astro ${darkSkyAlert.astroScore}/100`, C.success, C.successContainer, '#B7E0CF')}</div>
      <div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">
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
    .map(tag => metricChip(tag, ''))
    .join('');
  const darkSkyNote = spur.darkSky
    ? `<span style="font-family:${FONT};font-size:12px;color:${C.secondary};">&#x2605; Dark sky site</span>`
    : '';

  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:13px;font-weight:700;color:${C.ink};">${esc(spur.locationName)}</div>
    <div style="Margin:0 0 8px;font-family:${FONT};font-size:12px;color:${C.muted};">${esc(regionLabel)} &middot; ${spur.driveMins} min drive</div>
    <div style="font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};font-style:italic;">${esc(spur.hookLine)}</div>
    ${tagChips || darkSkyNote ? `<div style="Margin-top:8px;">${tagChips}${darkSkyNote}</div>` : ''}
  `, '', `border-left:4px solid ${C.primary};`);
}

function photoForecastCards(dailySummary: DaySummary[]): string {
  const forecastDays = dailySummary.filter(day => day.dayIdx >= 1).slice(0, 4);
  return listRows(forecastDays.map(day => {
    const dayIsAstroLed = (day.astroScore ?? 0) > (day.photoScore ?? 0);
    const { confidence: effConf } = effectiveConf(day, dayIsAstroLed);
    const conf = confidenceDetail(effConf);
    const bestAltHour = day.bestAlt?.isAstroWin
      ? day.bestAlt.bestAstroHour
      : day.bestAlt?.bestDayHour;
    const displayScore = day.headlineScore ?? day.photoScore;
    const altLine = day.bestAlt
      ? `Best backup: ${day.bestAlt.name} - ${day.bestAlt.bestScore}/100${bestAltHour ? ` at ${bestAltHour}` : ''}${day.bestAlt.isAstroWin ? ' (astro)' : ''}`
      : '';
    return card(`
      <div style="font-family:${FONT};font-size:16px;font-weight:700;line-height:1.3;color:${C.ink};">${esc(dayHeading(day))}</div>
      <div style="Margin-top:6px;">${scorePill(displayScore)}</div>
      <div style="Margin-top:6px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">${esc(forecastBestLine(day))}</div>
      <div style="Margin-top:8px;">
        ${metricChip('AM', day.amScore ?? 0, scoreState(day.amScore ?? 0).fg)}
        ${metricChip('PM', day.pmScore ?? 0, scoreState(day.pmScore ?? 0).fg)}
        ${metricChip('Astro', day.astroScore ?? 0, scoreState(day.astroScore ?? 0).fg)}
      </div>
      ${conf ? `<div style="Margin-top:8px;">${confidencePill(day, dayIsAstroLed)}</div>` : ''}

      ${altLine ? `<div style="Margin-top:6px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">${esc(altLine)}</div>` : ''}
      <div style="Margin-top:6px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">${daylightUtilityLine(day.carWash)}</div>
    `);
  }));
}

function daylightUtilityTodayCard(todayCarWash: CarWash): string {
  const cw = todayCarWash;
  const state = cw.score >= 75
    ? { fg: C.success, bg: C.successContainer, border: '#B7E0CF' }
    : cw.score >= 50
      ? { fg: C.primary, bg: C.primaryContainer, border: '#C5D6FF' }
      : { fg: C.error, bg: C.errorContainer, border: '#E8B8B4' };
  const window = cw.start !== '\u2014' ? `${cw.start}-${cw.end}` : '\u2014';
  return card(`
    <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">Daylight utility</div>
    <div style="Margin-top:4px;">${pill(`${cw.rating} ${cw.label}`, state.fg, state.bg, state.border)}</div>
    <div style="Margin-top:8px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.3;color:${C.ink};">${UTILITY_GLYPHS} ${esc(window)}</div>
    <div style="Margin-top:8px;">
      ${metricChip('Wind', `${cw.wind}km/h`, C.tertiary)}
      ${metricChip('Rain', `${cw.pp}%`, C.error)}
      ${metricChip('Temp', `${cw.tmp}C`, C.secondary)}
    </div>
  `);
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
    longRangeTop,
    longRangeCardLabel,
    darkSkyAlert,
    spurOfTheMoment,
  } = input;

  /* Hero card */
  const todayDay = dailySummary[0] || ({} as DaySummary);
  const topWindow = !dontBother ? windows?.[0] : null;
  const heroScore = topWindow?.peak ?? todayBestScore;
  const peakLocalHour = peakHourForWindow(topWindow || undefined) || todayDay.bestPhotoHour;
  const todayScoreState = scoreState(heroScore);
  const topWindowIsAstro = isAstroWindow(topWindow || undefined);
  const { confidence: todayEffConf, stdDev: todayEffStdDev } = effectiveConf(todayDay, topWindowIsAstro);
  const todayConfidence = confidenceDetail(todayEffConf);
  const topAlternative = altLocations?.[0] || todayDay.bestAlt || null;
  const topAltDelta = topAlternative && topWindow
    ? topAlternative.bestScore - topWindow.peak
    : 0;
  const astroGap = topWindow
    ? explainAstroScoreGap({ window: topWindow, today: todayDay })
    : null;
  const nextWindow = !dontBother ? windows?.[1] : null;
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
    { label: 'Best time', value: peakLocalHour || 'No clear slot', tone: C.onPrimaryContainer },
  ];

  const localSummary = dontBother
    ? 'Not a great photography day locally — better to enjoy the outdoors instead.'
    : [
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
      topAltDelta >= 25 && topAlternative
        ? `Or consider ${topAlternative.name} instead — significantly better conditions${topAlternative.darkSky ? ' for dark sky photography' : ''} (${topAlternative.driveMins} min drive).`
        : '',
    ].filter(Boolean).join('\n');

  const spurMatchesTopAlt =
    !!spurOfTheMoment && !!topAlternative && spurOfTheMoment.locationName === topAlternative.name;

  const altSpurHook = spurMatchesTopAlt ? `\n"${spurOfTheMoment!.hookLine}"` : '';

  const altTimingNote = topAlternative?.isAstroWin
    ? ` · astro from ${topAlternative.bestAstroHour || 'evening'}`
    : topAlternative?.bestDayHour
      ? ` · best at ${topAlternative.bestDayHour}`
      : '';

  const alternativeSummary = topAlternative
    ? `${topAlternative.name} · ${topAlternative.bestScore}/100 · ${topAlternative.driveMins} min drive${altTimingNote}${altSpurHook}`
    : '';

  const hero = card(`
  <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.onPrimaryContainer};opacity:0.82;">Photography brief</div>
  <div class="hero-title" style="Margin:0;font-family:${FONT};font-size:26px;font-weight:700;line-height:1.08;color:${C.onPrimaryContainer};">Leeds</div>
  <div style="Margin-top:4px;font-family:${FONT};font-size:14px;line-height:1.4;color:${C.onPrimaryContainer};opacity:0.9;">${esc(today)}</div>
  <div style="Margin-top:8px;">${pill(`${todayScoreState.label} - ${heroScore}/100`, todayScoreState.fg, todayScoreState.bg, todayScoreState.border)}</div>
  <div style="Margin-top:12px;border-radius:12px;background:rgba(255,255,255,0.38);border:1px solid rgba(16,42,92,0.12);overflow:hidden;">${summaryGrid(factStats, 2)}</div>
  <div style="Margin-top:10px;border-radius:12px;background:rgba(255,255,255,0.38);border:1px solid rgba(16,42,92,0.12);overflow:hidden;">${summaryGrid(scoreStats, 2)}</div>
  ${localSummary ? summaryNote('Today at a glance', localSummary) : ''}
  ${alternativeSummary ? summaryNote('Best nearby alternative', alternativeSummary) : ''}
`, 'hero-card', `background:${C.primaryContainer};border-color:#C5D6FF;`);

  /* Signal cards */
  const signals = signalCards(shSunriseQ, shSunsetQ, shSunsetText, sunDir, crepPeak, metarNote, peakKpTonight);

  /* Kit advisory */
  const kitTips = buildKitTips(todayCarWashData, windows, todayDay.astroScore ?? 0, moonPct);
  const kitCard = kitAdvisoryCard(kitTips);

  /* Assemble full HTML */
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="x-apple-disable-message-reformatting">
  <title>Leeds Photography Brief</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body, table, td, div, p, span, a {
      font-family: ${FONT} !important;
    }
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
    }
    @media screen and (max-width: 640px) {
      .outer-pad {
        padding: 8px !important;
      }
      .card-pad {
        padding: 10px 10px !important;
      }
      .hero-title {
        font-size: 18px !important;
        line-height: 1.08 !important;
      }
      .hero-card td[style*="border-left"] {
        border-left: none !important;
      }
      .section-title {
        font-size: 18px !important;
        line-height: 1.18 !important;
      }
      .pill,
      .chip {
        margin-right: 6px !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      body,
      .page-bg {
        background: #10131A !important;
      }
      .card {
        background: #181C24 !important;
        border-color: #313845 !important;
        box-shadow: none !important;
      }
      .hero-card {
        background: #25324B !important;
        border-color: #3C4A67 !important;
      }
      .hero-title,
      .section-title {
        color: #E3E8F2 !important;
      }
      .page-bg [style*="color:#171C24"] {
        color: #E3E8F2 !important;
      }
      .page-bg [style*="color:#5F6877"],
      .page-bg [style*="color:#7C8799"] {
        color: #B5BFCD !important;
      }
      .page-bg [style*="color:#102A5C"] {
        color: #DCE6FF !important;
      }
      .chip {
        background: #202530 !important;
        border-color: #394150 !important;
        color: #E3E8F2 !important;
      }
      .pill {
        color: inherit !important;
      }
      .tonal-note {
        background: #202530 !important;
      }
    }
  </style>
</head>
<body class="page-bg" style="margin:0;padding:0;background:${C.page};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="page-bg" style="width:100%;border-collapse:collapse;background:${C.page};">
    <tr>
      <td align="center" class="outer-pad" style="padding:10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;border-collapse:collapse;">
          <tr>
            <td>
              ${hero}
            </td>
          </tr>
          ${signals ? spacer(6) + `<tr><td>${signals}</td></tr>` : ''}
          ${spacer(10)}
          <tr>
            <td>${sectionTitle('Today\'s window')}</td>
          </tr>
          <tr>
            <td>${todayWindowSection(dontBother, todayBestScore, aiText, windows, dailySummary, altLocations, compositionBullets)}</td>
          </tr>
          ${kitCard ? spacer(6) + `<tr><td>${kitCard}</td></tr>` : ''}
          ${spacer(10)}
          <tr>
            <td>${sectionTitle('Alternatives')}</td>
          </tr>
          <tr>
            <td>${alternativeSection(altLocations, noAltsMsg)}</td>
          </tr>
          ${(() => {
            const lr = longRangeSection(longRangeTop, longRangeCardLabel, darkSkyAlert);
            return lr ? spacer(10) + `<tr><td>${sectionTitle('If you had the day')}</td></tr><tr><td>${lr}</td></tr>` : '';
          })()}
          ${spacer(6)}
          <tr>
            <td>${daylightUtilityTodayCard(todayCarWashData)}</td>
          </tr>
          ${spacer(10)}
          <tr>
            <td>${sectionTitle('Days ahead')}</td>
          </tr>
          ${weekInsight ? `<tr><td>${card(`<div style="font-family:${FONT};font-size:13px;line-height:1.45;color:${C.muted};">${esc(weekInsight)}</div>`, '', `border-left:4px solid ${C.tertiary};`)}</td></tr>${spacer(6)}` : ''}
          <tr>
            <td>${photoForecastCards(dailySummary)}</td>
          </tr>
          ${spurOfTheMoment && !spurMatchesTopAlt ? spacer(10) + `<tr><td>${sectionTitle('Spur of the moment')}</td></tr><tr><td>${spurOfTheMomentCard(spurOfTheMoment)}</td></tr>` : ''}
          ${spacer(10)}
          <tr>
            <td>
              <div style="padding:8px 4px;font-family:${FONT};font-size:10px;line-height:1.5;color:${C.subtle};">
                <b>Key</b> &middot;
                AM/PM = sunrise &amp; sunset light quality &middot;
                Astro = night sky potential (clear skies + dark moon) &middot;
                Crepuscular rays = shafts of light through broken cloud near the horizon &middot;
                Spread = how much forecast models disagree (lower is more reliable) &middot;
                Daylight spread = based on golden-hour ensemble · Astro spread = based on night-hour ensemble
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function debugCard(title: string, body: string): string {
  return card(
    `<div style="font-family:${FONT};font-size:14px;font-weight:700;line-height:1.3;color:${C.ink};Margin:0 0 8px;">${esc(title)}</div>${body}`,
    '',
    'border-left:4px solid #C5D6FF;',
  );
}

function debugTable(headers: string[], rows: string[][]): string {
  if (!rows.length) {
    return `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">No data recorded for this run.</div>`;
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        ${headers.map(header => `<th align="left" style="padding:6px 8px;border-bottom:1px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:700;line-height:1.3;color:${C.muted};text-transform:uppercase;">${esc(header)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows.map(row => `<tr>${row.map(cell => `<td valign="top" style="padding:7px 8px;border-bottom:1px solid ${C.surfaceVariant};font-family:${FONT};font-size:12px;line-height:1.45;color:${C.ink};">${cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>`;
}

function debugKeyValueLines(items: Array<[string, string | number | null | undefined]>): string {
  return items
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};"><span style="font-weight:700;color:${C.onPrimaryContainer};">${esc(label)}:</span> ${esc(value)}</div>`)
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
  const windowRows = debugContext.windows.map(window => ([
    esc(`#${window.rank}`),
    esc(window.label),
    esc(`${window.start}-${window.end}`),
    esc(String(window.peak)),
    esc(window.selected ? 'Yes' : 'No'),
    esc(window.selectionReason),
    esc(window.darkPhaseStart ? `Dark after ${window.darkPhaseStart}${window.postMoonsetScore !== null && window.postMoonsetScore !== undefined ? ` (${window.postMoonsetScore}/100)` : ''}` : '—'),
  ]));
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
          ['Rank', 'Window', 'Range', 'Peak', 'Selected', 'Reason', 'Dark phase'],
          windowRows,
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
        ${aiTrace ? `${spacer(8)}${debugCard('AI editorial trace', `
          ${debugKeyValueLines([
            ['Factual check', aiTrace.factualCheck.passed ? 'Passed' : `Failed (${aiTrace.factualCheck.rulesTriggered.join(', ')})`],
            ['Editorial check', aiTrace.editorialCheck.passed ? 'Passed' : `Failed (${aiTrace.editorialCheck.rulesTriggered.join(', ')})`],
            ['Fallback used', aiTrace.fallbackUsed ? 'Yes' : 'No'],
            ['Spur suggestion', aiTrace.spurSuggestion.raw ? `${aiTrace.spurSuggestion.raw}${aiTrace.spurSuggestion.dropped ? ` (dropped: ${aiTrace.spurSuggestion.dropReason || 'no reason recorded'})` : ''}` : 'None'],
            ['Resolved spur', aiTrace.spurSuggestion.resolved || null],
            ['weekStandout', (() => {
              const ws = aiTrace.weekStandout;
              if (ws.parseStatus === 'parse-failure') return '⚠️ parse failure (fenced/malformed JSON) — dropped [ALERT]';
              if (ws.parseStatus === 'absent') return 'absent from raw response — model did not generate';
              if (!ws.used) return `present in raw response (empty string) — not used`;
              return `present in raw response → used: "${ws.rawValue}"`;
            })()],
          ])}
          <div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Raw Groq response</div>
          <pre style="Margin:6px 0 0;padding:10px;background:${C.surfaceVariant};border:1px solid ${C.outline};border-radius:8px;white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;font-size:11px;line-height:1.45;color:${C.ink};">${esc(aiTrace.rawGroqResponse || '(empty)')}</pre>
          <div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Normalized AI text</div>
          <div style="Margin-top:4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">${esc(aiTrace.normalizedAiText || '(empty)')}</div>
          <div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Final AI text</div>
          <div style="Margin-top:4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">${esc(aiTrace.finalAiText || '(empty)')}</div>
        `)}` : ''}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
