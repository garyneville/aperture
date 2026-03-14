import { esc } from './utils.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WindowHour {
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
  fallback?: boolean;
  hours?: WindowHour[];
  tops?: string[];
}

export interface AltLocation {
  name: string;
  driveMins: number;
  bestScore: number;
  bestDayHour?: string;
  bestAstroHour?: string;
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
  confidence?: string;
  confidenceStdDev?: number | null;
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

function confidenceDetail(day: DaySummary | undefined): { label: string; fg: string; bg: string; border: string } | null {
  if (!day?.confidence || day.confidence === 'unknown') return null;
  if (day.confidence === 'high') {
    return { label: 'High certainty', fg: C.success, bg: C.successContainer, border: '#B7E0CF' };
  }
  if (day.confidence === 'medium') {
    return { label: 'Fair certainty', fg: C.warning, bg: C.warningContainer, border: '#F0D58D' };
  }
  return { label: 'Low certainty', fg: C.error, bg: C.errorContainer, border: '#E8B8B4' };
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

function confidencePill(day: DaySummary): string {
  const detail = confidenceDetail(day);
  if (!detail) return '';
  const spread = day.confidenceStdDev !== null && day.confidenceStdDev !== undefined
    ? `${detail.label} - spread ${day.confidenceStdDev} pts`
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

function windowCard(w: Window, index: number, windows: Window[]): string {
  const h = w.hours?.find(x => x.score === w.peak) || w.hours?.[0] || {} as WindowHour;
  const notes: string[] = [];
  const topWindow = windows[0];
  if (w.fallback) notes.push('Most promising narrow stretch rather than a clean standout window.');
  if ((h.crepuscular || 0) > 45) notes.push(`Crepuscular rays ${h.crepuscular}/100.`);
  if (index > 0 && isAstroWindow(topWindow) && isAstroWindow(w) && topWindow?.label !== w.label) {
    notes.push('Later, darker backup if you miss the first astro slot.');
  }
  const metricLine = metricRun([
    { label: 'Cloud high', value: `${h.ch ?? '-'}%`, tone: C.primary },
    { label: 'Visibility', value: `${h.visK ?? '-'}km`, tone: C.secondary },
    { label: 'Wind', value: `${h.wind ?? '-'}km/h`, tone: C.tertiary },
    { label: 'Rain', value: `${h.pp ?? '-'}%`, tone: C.error },
    ...(h.tpw ? [{ label: 'TPW', value: `${h.tpw}mm`, tone: C.primary }] : []),
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
    <div style="Margin:4px 0 0;font-family:${FONT};font-size:13px;line-height:1.4;color:${C.muted};">${esc(w.start)}-${esc(w.end)}</div>
    <div style="Margin-top:8px;">${scorePill(w.peak)}</div>
    <div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">${metricLine}</div>
    ${tags}
    ${noteBlock}
  `, '', index === 0 ? `border-top:4px solid ${scoreState(w.peak).fg};` : '');
}

function todayWindowSection(
  dontBother: boolean,
  todayBestScore: number,
  aiText: string,
  windows: Window[] | undefined,
): string {
  if (dontBother) {
    return card(`
      <div style="Margin:0 0 3px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.error};">Today&apos;s call</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:700;line-height:1.24;color:${C.ink};">Not worth shooting locally</div>
      <div style="Margin-top:8px;">${scorePill(todayBestScore)}</div>
      <div style="Margin-top:8px;">${htmlText(aiText)}</div>
    `, '', `border-top:4px solid ${C.error};`);
  }
  return listRows([
    ...(windows || []).map((w, index) => windowCard(w, index, windows || [])),
    card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.subtle};">AI briefing</div>
      ${htmlText(aiText)}
    `, '', `border-left:4px solid ${C.primary};`),
  ]);
}

function signalCards(
  shSunriseQ: number | null,
  shSunsetQ: number | null,
  shSunsetText: string | undefined,
  sunDir: number | null,
  crepPeak: number,
  metarNote: string | undefined,
): string {
  const cards: string[] = [];
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

function photoForecastCards(dailySummary: DaySummary[]): string {
  return listRows(dailySummary.map(day => {
    const conf = confidenceDetail(day);
    const bestAltHour = day.bestAlt?.isAstroWin
      ? day.bestAlt.bestAstroHour
      : day.bestAlt?.bestDayHour;
    const altLine = day.bestAlt
      ? `Best backup: ${day.bestAlt.name} - ${day.bestAlt.bestScore}/100${bestAltHour ? ` at ${bestAltHour}` : ''}${day.bestAlt.isAstroWin ? ' (astro)' : ''}`
      : '';
    const utilityWindow = day.carWash.start !== '\u2014' ? `${day.carWash.start}-${day.carWash.end}` : '\u2014';
    const utilityLine = `🚗 / 🚶 Daylight utility: ${utilityWindow} · Wind ${day.carWash.wind}km/h · Rain ${day.carWash.pp}% · Temp ${day.carWash.tmp}C`;
    return card(`
      <div style="font-family:${FONT};font-size:16px;font-weight:700;line-height:1.3;color:${C.ink};">${esc(dayHeading(day))}</div>
      <div style="Margin-top:6px;">${scorePill(day.headlineScore ?? day.photoScore)}</div>
      <div style="Margin-top:6px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">${esc(day.bestPhotoHour || '-')} - ${esc(day.bestTags || 'no clear window')}</div>
      <div style="Margin-top:8px;">
        ${metricChip('AM', (day.amScore ?? 0) + (day.amConfidence && day.amConfidence !== 'unknown' ? ' \u00b7 ' + (day.amConfidence === 'high' ? '\u00b1' : day.amConfidence === 'medium' ? '~' : '?') : ''), scoreState(day.amScore ?? 0).fg)}
        ${metricChip('PM', (day.pmScore ?? 0) + (day.pmConfidence && day.pmConfidence !== 'unknown' ? ' \u00b7 ' + (day.pmConfidence === 'high' ? '\u00b1' : day.pmConfidence === 'medium' ? '~' : '?') : ''), scoreState(day.pmScore ?? 0).fg)}
        ${metricChip('Astro', day.astroScore ?? 0, scoreState(day.astroScore ?? 0).fg)}
      </div>
      ${conf ? `<div style="Margin-top:8px;">${confidencePill(day)}</div>` : ''}

      ${altLine ? `<div style="Margin-top:6px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">${esc(altLine)}</div>` : ''}
      <div style="Margin-top:6px;font-family:${FONT};font-size:12px;line-height:1.45;color:${C.muted};">${esc(utilityLine)}</div>
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
    <div style="Margin-top:8px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.3;color:${C.ink};">🚗 / 🚶 ${esc(window)}</div>
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
  } = input;

  /* Hero card */
  const todayDay = dailySummary[0] || ({} as DaySummary);
  const topWindow = !dontBother ? windows?.[0] : null;
  const heroScore = topWindow?.peak ?? todayBestScore;
  const todayScoreState = scoreState(heroScore);
  const todayConfidence = confidenceDetail(todayDay);
  const topAlternative = altLocations?.[0] || todayDay.bestAlt || null;
  const topAltDelta = topAlternative ? topAlternative.bestScore - heroScore : 0;
  const overallAstroDelta = typeof todayDay.astroScore === 'number' ? todayDay.astroScore - heroScore : 0;
  const nextWindow = !dontBother ? windows?.[1] : null;
  const factStats: SummaryStat[] = [
    { label: 'Sunrise', value: sunriseStr, tone: C.primary },
    { label: 'Sunset', value: sunsetStr, tone: C.primary },
    { label: 'Moon', value: `${moonDescriptor(moonPct)} · ${moonPct}% lit`, tone: C.tertiary },
  ];

  if (todayConfidence) {
    factStats.push({
      label: 'Certainty',
      value: todayDay.confidenceStdDev !== null && todayDay.confidenceStdDev !== undefined
        ? `${todayConfidence.label} · spread ${todayDay.confidenceStdDev} pts`
        : todayConfidence.label,
      tone: todayConfidence.fg,
    });
  }

  const scoreStats: SummaryStat[] = [
    { label: 'AM light', value: `${todayDay.amScore ?? 0}/100`, tone: scoreState(todayDay.amScore ?? 0).fg },
    { label: 'PM light', value: `${todayDay.pmScore ?? 0}/100`, tone: scoreState(todayDay.pmScore ?? 0).fg },
    { label: 'Overall astro', value: `${todayDay.astroScore ?? 0}/100`, tone: scoreState(todayDay.astroScore ?? 0).fg },
    { label: 'Best local', value: todayDay.bestPhotoHour || 'No clear slot', tone: C.onPrimaryContainer },
  ];

  const localSummary = [
    topWindow
      ? `${topWindow.label}: ${topWindow.start}-${topWindow.end} at ${topWindow.peak}/100.`
      : todayDay.bestTags
        ? `Best local setup: ${todayDay.bestPhotoHour || 'time TBD'} for ${todayDay.bestTags}.`
        : todayDay.bestPhotoHour
          ? `Best local setup: ${todayDay.bestPhotoHour}.`
          : '',
    overallAstroDelta >= 10
      ? `Overall astro potential still peaks ${overallAstroDelta} points higher than the named local window.`
      : '',
    topAltDelta >= 10 && topAlternative
      ? `${topAlternative.name} adds ${topAltDelta} points${topAlternative.darkSky ? ' with darker skies' : ''}${topAlternative.isAstroWin ? ` at ${topAlternative.bestAstroHour || 'nightfall'}` : topAlternative.bestDayHour ? ` at ${topAlternative.bestDayHour}` : ''}.`
      : nextWindow && isAstroWindow(topWindow || undefined) && isAstroWindow(nextWindow)
        ? `${nextWindow.label}: ${nextWindow.start}-${nextWindow.end} at ${nextWindow.peak}/100 if you miss the first slot.`
        : '',
  ].filter(Boolean).join('\n');

  const alternativeSummary = topAlternative
    ? `${topAlternative.name} · ${topAlternative.bestScore}/100${topAlternative.isAstroWin ? ` · astro ${topAlternative.bestAstroHour || 'evening'}` : topAlternative.bestDayHour ? ` · ${topAlternative.bestDayHour}` : ''} · ${topAlternative.driveMins} min drive`
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
  const signals = signalCards(shSunriseQ, shSunsetQ, shSunsetText, sunDir, crepPeak, metarNote);

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
            <td>${todayWindowSection(dontBother, todayBestScore, aiText, windows)}</td>
          </tr>
          ${spacer(6)}
          <tr>
            <td>${daylightUtilityTodayCard(todayCarWashData)}</td>
          </tr>
          ${spacer(10)}
          <tr>
            <td>${sectionTitle('Alternatives')}</td>
          </tr>
          <tr>
            <td>${alternativeSection(altLocations, noAltsMsg)}</td>
          </tr>
          ${spacer(10)}
          <tr>
            <td>${sectionTitle('5-day photography')}</td>
          </tr>

          <tr>
            <td>${photoForecastCards(dailySummary)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
