import { bar, pad, rpad } from './utils.js';

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

export interface FormatTelegramInput {
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
  peakKpTonight?: number | null;
  longRangeTop?: LongRangeCard | null;
  longRangeCardLabel?: string | null;
  darkSkyAlert?: DarkSkyAlertCard | null;
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function altsTelegram(alts: AltLocation[] | undefined): string {
  if (!alts || !alts.length) return '\n<i>No nearby locations score well enough today.</i>';
  return '\n' + alts.map(l => {
    const icon = l.isAstroWin ? '\ud83c\udf0c' : l.bestScore >= 75 ? '\ud83d\udd25' : '\u2705';
    const note = l.isAstroWin
      ? `astrophotography${l.darkSky ? ' \u2b50 dark sky' : ''}`
      : `best ${l.bestDayHour} \u00b7 ${(l.types || []).slice(0, 2).join(', ')}`;
    return `${icon} <b>${l.name}</b> ${l.driveMins}min \u2014 [${l.bestScore}/100] ${note}`;
  }).join('\n');
}

function windowsTelegram(wins: Window[] | undefined): string {
  if (!wins || !wins.length) return '<i>No clear shooting window today.</i>';
  return wins.map((w, i) => {
    const h = w.hours?.find(x => x.score === w.peak) || w.hours?.[0];
    const hdr = i === 0 ? '\ud83d\udd25' : i === 1 ? '\ud83c\udf24' : '\ud83d\udca1';
    const ray = (h?.crepuscular || 0) > 45 ? `  \ud83c\udf1f Rays ${h!.crepuscular}/100` : '';
    const narrow = w.fallback ? '  [best chance]' : '';
    const range = w.start === w.end ? w.start : `${w.start}\u2013${w.end}`;
    return `${hdr} <b>${w.label}</b>  ${range}  [<b>${w.peak}</b>/100]${narrow}\n` +
      `   \u2601\ufe0f ${h?.ch}%hi  \ud83d\udc41 ${h?.visK}km  \ud83d\udca8 ${h?.wind}  \ud83c\udf27 ${h?.pp}%${ray}\n` +
      `   <i>${(w.tops || []).join(' \u00b7 ')}</i>`;
  }).join('\n\n');
}

function photoFiveDayTelegram(days: DaySummary[]): string {
  const forecastDays = days.filter(d => d.dayIdx >= 1).slice(0, 4);
  const lines = forecastDays.map(d => {
    const alt = d.bestAlt ? `  \ud83d\udccd${d.bestAlt.name.split(' ')[0]}` : '';
    const confTag = d.confidence === 'low' ? '?' : d.confidence === 'medium' ? '~' : '';
    const label = pad(d.dayLabel, 9);
    const scoreStr = rpad(d.headlineScore ?? d.photoScore, 3);
    const b = bar(d.headlineScore ?? d.photoScore);
    const am = rpad(d.amScore ?? 0, 2);
    const pm = rpad(d.pmScore ?? 0, 2);
    const as = rpad(d.astroScore ?? 0, 2);
    return `${d.photoEmoji} ${label} ${scoreStr} ${b} \u2600${am} \ud83c\udf07${pm} \ud83c\udf0c${as}${confTag}${alt}`;
  });
  return '<code>' + lines.join('\n') + '</code>';
}

function cwFiveDayTelegram(days: DaySummary[]): string {
  const forecastDays = days.filter(d => d.dayIdx >= 1).slice(0, 4);
  const lines = forecastDays.map(d => {
    const cw = d.carWash;
    const label = pad(d.dayLabel, 9);
    const window = cw.start !== '\u2014' ? `${cw.start}\u2013${cw.end}` : '    \u2014    ';
    const wind = rpad(cw.wind + 'kmh', 6);
    const pp = rpad(cw.pp + '%', 4);
    return `${cw.rating} ${label} ${pad(cw.label, 5)}  ${window}  \ud83d\udca8${wind} ${cw.pp < 15 ? '\u2600\ufe0f' : cw.pp < 35 ? '\ud83c\udf24' : cw.pp < 60 ? '\ud83c\udf26' : '\ud83c\udf27'}${pp}`;
  });
  return '<code>' + lines.join('\n') + '</code>';
}

function longRangeTelegram(
  longRangeTop: LongRangeCard | null | undefined,
  cardLabel: string | null | undefined,
  darkSkyAlert: DarkSkyAlertCard | null | undefined,
): string {
  const lines: string[] = [];
  if (longRangeTop && cardLabel) {
    const region = longRangeTop.region.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const timing = longRangeTop.isAstroWin
      ? `astro from ${longRangeTop.bestAstroHour || 'evening'}${longRangeTop.darkSky ? ' \u2b50 dark sky' : ''}`
      : `best ${longRangeTop.bestDayHour || 'TBD'} \u00b7 ${longRangeTop.tags.slice(0, 2).join(', ')}`;
    lines.push(`\ud83c\udf0d <b>${cardLabel}</b>\n\ud83d\udd25 <b>${longRangeTop.name}</b> [${longRangeTop.bestScore}/100] ${region} \u00b7 ${longRangeTop.driveMins}min \u00b7 ${timing}`);
  }
  if (darkSkyAlert && (!longRangeTop || darkSkyAlert.name !== longRangeTop?.name)) {
    lines.push(`\ud83c\udf0c <b>Dark sky alert:</b> ${darkSkyAlert.name} \u2014 astro ${darkSkyAlert.astroScore}/100 from ${darkSkyAlert.bestAstroHour || 'nightfall'} (${darkSkyAlert.driveMins}min)`);
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function formatTelegram(input: FormatTelegramInput): string {
  const {
    dontBother,
    windows,
    dailySummary,
    altLocations,
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
    peakKpTonight,
    longRangeTop,
    longRangeCardLabel,
    darkSkyAlert,
  } = input;

  const auroraLine = peakKpTonight !== null && peakKpTonight !== undefined && peakKpTonight >= 5
    ? `\uD83C\uDF0C Aurora Kp ${peakKpTonight.toFixed(1)} forecast tonight${peakKpTonight >= 6 ? ' \u2014 visible ~54\u00b0N' : ' \u2014 approaching threshold'}\n`
    : '';

  const shLine = (shSunriseQ !== null || shSunsetQ !== null)
    ? `\ud83c\udfa8 Hue rise <b>${shSunriseQ ?? '\u2014'}%</b>  set <b>${shSunsetQ ?? '\u2014'}%</b> (${shSunsetText || '\u2014'})${sunDir !== null ? `  \u2600\ufe0f ${Math.round(sunDir!)}\u00b0` : ''}${crepPeak > 45 ? `  \ud83c\udf1f Rays ${crepPeak}/100` : ''}\n`
    : '';

  const DIV = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';

  const lrLine = longRangeTelegram(longRangeTop, longRangeCardLabel, darkSkyAlert);
  const lrSection = lrLine ? `\n${DIV}${lrLine}\n` : '';

  if (dontBother) {
    return `\ud83d\udcf7 <b>Leeds Photo Brief</b> \u2014 ${today}\n\ud83c\udf05 ${sunriseStr}  \ud83c\udf07 ${sunsetStr}  \ud83c\udf19 ${moonPct}% moon\n${shLine}${auroraLine}${metarNote ? metarNote + '\n' : ''}${DIV}\u274c <b>Not worth it today</b>  [${todayBestScore}/100]\n${aiText}\n\n\ud83d\udccd <b>Other places to consider today:</b>${altsTelegram(altLocations)}${lrSection}\n${DIV}<b>\ud83d\udcc5 Days Ahead</b>\n${photoFiveDayTelegram(dailySummary)}\n\n<b>\ud83d\ude97 Car Wash Forecast</b>\n${cwFiveDayTelegram(dailySummary)}`;
  }

  return `\ud83d\udcf7 <b>Leeds Photo Brief</b> \u2014 ${today}\n\ud83c\udf05 ${sunriseStr}  \ud83c\udf07 ${sunsetStr}  \ud83c\udf19 ${moonPct}% moon\n${shLine}${auroraLine}${metarNote ? metarNote + '\n' : ''}${DIV}${windowsTelegram(windows)}\n\n\ud83d\udcac <i>${aiText}</i>\n\n\ud83d\udccd <b>Other places to consider today:</b>${altsTelegram(altLocations)}${lrSection}\n${DIV}<b>\ud83d\udcc5 Days Ahead</b>\n${photoFiveDayTelegram(dailySummary)}\n\n<b>\ud83d\ude97 Car Wash Forecast</b>\n${cwFiveDayTelegram(dailySummary)}`;
}
