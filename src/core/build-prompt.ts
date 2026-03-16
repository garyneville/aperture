import type { Window, DailySummary, CarWash } from './best-windows.js';
import { explainAstroScoreGap } from './astro-score-explanation.js';
import { LONG_RANGE_LOCATIONS } from './long-range-locations.js';
import { PHOTO_BRIEF_WORKFLOW_VERSION, getPhotoWeatherLat, getPhotoWeatherLocation, getPhotoWeatherLon, getPhotoWeatherTimezone } from '../config.js';
import { emptyDebugContext, type DebugContext } from './debug-context.js';
import { HOME_SITE_DARKNESS } from './site-darkness.js';

const SPUR_LOCATION_NAMES = LONG_RANGE_LOCATIONS.map(l => l.name).join(', ');

const SEASONAL_CONTEXT: Record<number, string> = {
  1:  'January — frost and snow possible on high ground; bare trees; frozen reservoirs.',
  2:  'February — snowdrops in woodland; low sun angle throughout the day.',
  3:  'March — early spring; blossom building; frost on clear nights still likely.',
  4:  'April — bluebells peak late month; lambs in the Dales; dramatic cloud building.',
  5:  'May — full canopy; bluebells finishing; long golden hour windows.',
  6:  'June — longest days; very late sunsets (~21:30); short nights limit astro.',
  7:  'July — summer haze; heather not yet out; long blue hours.',
  8:  'August — heather on the moors; Perseid meteor shower mid-month.',
  9:  'September — golden light returns; mist in valleys from temperature swings.',
  10: 'October — autumn colour; low sun, long shadows; morning frosts returning.',
  11: 'November — bare trees re-emerging; dramatic skies; short days.',
  12: 'December — winter light; snow possible on Pennines; very short days.',
};

export interface KpEntry {
  time: string;
  kp: number;
}

export interface BuildPromptInput {
  windows: Window[];
  dontBother: boolean;
  todayBestScore: number;
  todayCarWash: CarWash;
  dailySummary: DailySummary[];
  altLocations?: AltLocationResult[];
  noAltsMsg?: string | null;
  metarNote: string;
  sunrise?: string;
  sunset?: string;
  moonPct: number;
  kpForecast?: KpEntry[];
  now?: Date;
  debugContext?: DebugContext;
}

export interface AltLocationResult {
  name: string;
  driveMins: number;
  bestScore: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  isAstroWin: boolean;
  darkSky: boolean;
  types: string[];
}

export interface BuildPromptOutput {
  prompt: string;
  dontBother: boolean;
  windows: Window[];
  todayCarWash: CarWash;
  dailySummary: DailySummary[];
  altLocations?: AltLocationResult[];
  noAltsMsg?: string | null;
  sunriseStr: string;
  sunsetStr: string;
  moonPct: number;
  metarNote: string;
  today: string;
  todayBestScore: number;
  shSunsetQ: number | null;
  shSunriseQ: number | null;
  shSunsetText: string | null;
  sunDir: number | null;
  crepPeak: number;
  peakKpTonight: number | null;
  debugContext: DebugContext;
}

function confidenceLabel(confidence: string): string {
  if (confidence === 'high') return 'high';
  if (confidence === 'medium') return 'fair';
  if (confidence === 'low') return 'low';
  return 'unknown';
}

function topAlternativeLine(altLocations?: AltLocationResult[]): string {
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

function alternativePromptSection(title: string, alts: AltLocationResult[]): string {
  if (!alts.length) return '';
  return `${title}:\n${alts.slice(0, 3).map(l =>
    `- ${l.name} (${l.driveMins}min): ${l.bestScore}/100` +
    (l.isAstroWin
      ? ` best astro ${l.bestAstroHour || 'evening'}${l.darkSky ? ' (dark sky)' : ''}`
      : ` ${dayAlternativeTiming(l.bestDayHour)}`)
  ).join('\n')}`;
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

function windowTrendInsight(window: Window | undefined): string {
  if (!window?.hours?.length) return '';
  const peakHour = peakHourForWindow(window);
  if (!peakHour) return '';

  if (window.start === window.end) return '';

  const firstHour = window.hours[0];
  const lastHour = window.hours[window.hours.length - 1];
  const firstScore = typeof firstHour?.score === 'number' ? firstHour.score : null;
  const lastScore = typeof lastHour?.score === 'number' ? lastHour.score : null;

  if (peakHour === window.end && firstScore !== null && lastScore !== null && lastScore - firstScore >= 6) {
    return `- Peak local time is around ${peakHour}, with conditions improving through the window.`;
  }

  if (peakHour === window.start && firstScore !== null && lastScore !== null && firstScore - lastScore >= 6) {
    return `- Peak local time is around ${peakHour}, right as the window opens.`;
  }

  if (peakHour === window.end) return `- Peak local time is around ${peakHour}, near the end of the window.`;
  if (peakHour === window.start) return `- Peak local time is around ${peakHour}, right at the start of the window.`;
  return `- Peak local time is around ${peakHour}, within the ${window.label.toLowerCase()}.`;
}

function peakKpForNight(kpForecast: KpEntry[] | undefined, now: Date): number | null {
  if (!kpForecast || !kpForecast.length) return null;
  const tonightStart = new Date(now);
  tonightStart.setHours(18, 0, 0, 0);
  const tonightEnd = new Date(now);
  tonightEnd.setDate(tonightEnd.getDate() + 1);
  tonightEnd.setHours(6, 0, 0, 0);
  let peak: number | null = null;
  for (const entry of kpForecast) {
    const t = new Date(entry.time);
    if (t >= tonightStart && t <= tonightEnd) {
      if (peak === null || entry.kp > peak) peak = entry.kp;
    }
  }
  return peak;
}

function weekSummaryLine(dailySummary: DailySummary[]): string {
  return dailySummary.slice(0, 5).map(d => {
    const score = d.headlineScore ?? d.photoScore;
    if (!d.confidence || d.confidence === 'unknown') return `${d.dayLabel}: ${score}/100`;
    const spreadPart = d.confidenceStdDev != null
      ? ` spread ${d.confidenceStdDev}`
      : '';
    return `${d.dayLabel}: ${score}/100 (${d.confidence} confidence${spreadPart})`;
  }).join(' | ');
}

function moonTimingNote(todayDay: DailySummary | undefined): string {
  if (!todayDay?.darkSkyStartsAt || (todayDay.astroScore ?? 0) <= 0) return '';
  return `\nDark-sky conditions improve from ${todayDay.darkSkyStartsAt} once the moon is down.`;
}

/** Milky Way galactic core is usefully above the horizon from UK latitudes roughly April–September. */
function isMilkyWaySeason(month: number): boolean {
  return month >= 4 && month <= 9;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Generates sky-quality constraints for the COMPOSITION prompt section.
 * Conditions local shot ideas on Bortle class, season, moon phase, and whether
 * a dark-sky alternative exists, without letting the composition drift away
 * from the named local window.
 */
function skyQualityConstraints(
  month: number,
  moonPct: number,
  topAlt: AltLocationResult | undefined,
  isAstroWin: boolean,
): string {
  if (!isAstroWin) return '';

  const milkyWaySeason = isMilkyWaySeason(month);
  const homeBortle = HOME_SITE_DARKNESS.bortle;
  const homeLocation = getPhotoWeatherLocation();
  const parts: string[] = [
    'Composition bullets must stay focused on the named local window and local conditions. Do not turn them into travel or remote-location shot plans.',
  ];

  parts.push(
    `Home location (${homeLocation}) is Bortle ${homeBortle} — significant light pollution. ` +
    `Do NOT suggest Milky Way core shots for the home session; bias toward: star trails with a ` +
    `silhouetted landmark foreground, wide-field constellation framing, moonlit architecture, or light-painting.`,
  );

  if (!milkyWaySeason) {
    parts.push(
      `Milky Way core is NOT seasonally visible from UK in ${MONTH_NAMES[month - 1]} ` +
      `(core only viable roughly April–September from UK latitudes). ` +
      `Do not suggest Milky Way photography at any location this month. ` +
      `Instead consider: star trails, aurora potential (if Kp elevated), constellation framing, ` +
      `or moonlit architecture.`,
    );
  }

  if (moonPct > 60) {
    parts.push(
      `Moon is ${moonPct}% illuminated — prioritise moonlit architecture or illuminated landscape silhouettes ` +
      `over faint-star or deep-sky work.`,
    );
  } else if (moonPct < 20 && milkyWaySeason) {
    parts.push(
      `Moon is ${moonPct}% — dark enough for wide-field star work or Milky Way if at a dark-sky site.`,
    );
  }

  if (topAlt?.darkSky) {
    if (milkyWaySeason) {
      parts.push(
        `${topAlt.name} is a genuine dark-sky alternative where Milky Way work may be viable, ` +
        `but keep the composition bullets about the local session rather than the remote alternative.`,
      );
    } else {
      parts.push(
        `${topAlt.name} is a dark-sky alternative but Milky Way core is out of season — ` +
        `suggest wide-field star trails or aurora if Kp permits rather than Milky Way, and keep composition bullets local.`,
      );
    }
  }

  return `Sky quality constraints for shot ideas:\n${parts.map(p => `- ${p}`).join('\n')}`;
}

export function buildPrompt(input: BuildPromptInput): BuildPromptOutput {
  const {
    windows, dontBother, todayBestScore, todayCarWash,
    dailySummary, altLocations, noAltsMsg, metarNote,
    sunrise, sunset, moonPct, kpForecast,
  } = input;

  const now = input.now || new Date();
  const debugContext = input.debugContext || emptyDebugContext();

  const sunriseStr = sunrise
    ? new Date(sunrise).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
    : '--:--';
  const sunsetStr = sunset
    ? new Date(sunset).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
    : '--:--';
  const today = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London',
  });

  const seasonalNote = SEASONAL_CONTEXT[now.getMonth() + 1] || '';
  const peakKpTonight = peakKpForNight(kpForecast, now);
  const auroraNote = peakKpTonight !== null && peakKpTonight >= 5
    ? `Aurora alert: Kp ${peakKpTonight.toFixed(1)} forecast tonight — visible at ~54°N above Kp 6.`
    : '';
  const weekLine = weekSummaryLine(dailySummary);

  const todayDay = dailySummary[0];
  const hasLocalWindow = windows.length > 0;
  const effectiveDontBother = dontBother || !hasLocalWindow;

  debugContext.metadata = {
    generatedAt: now.toISOString(),
    location: getPhotoWeatherLocation(),
    latitude: getPhotoWeatherLat(),
    longitude: getPhotoWeatherLon(),
    timezone: getPhotoWeatherTimezone(),
    workflowVersion: PHOTO_BRIEF_WORKFLOW_VERSION,
    debugModeEnabled: false,
    debugModeSource: null,
    debugRecipient: null,
  };

  const selectedWindowIsAstro = isAstroWindow(windows[0]);
  let confNote = '';
  if (selectedWindowIsAstro) {
    const ac = todayDay?.astroConfidence;
    if (ac && ac !== 'unknown') {
      confNote = `\nForecast certainty (astro window): ${confidenceLabel(ac)}.` +
        (todayDay?.astroConfidenceStdDev !== null && todayDay?.astroConfidenceStdDev !== undefined
          ? ` Night-hour models differ by about ${todayDay.astroConfidenceStdDev} cloud-cover points.`
          : '');
    }
  } else if (todayDay?.confidence && todayDay.confidence !== 'unknown') {
    confNote = `\nForecast certainty: ${confidenceLabel(todayDay.confidence)}.` +
      (todayDay.confidenceStdDev !== null && todayDay.confidenceStdDev !== undefined
        ? ` Forecast models differ by about ${todayDay.confidenceStdDev} cloud-cover points during the key shooting hours.`
        : '');
  }

  const shInfo = todayDay
    ? `SunsetHue golden-hour quality — sunrise: ${todayDay.shSunriseQuality ?? 'N/A'}% | sunset: ${todayDay.shSunsetQuality ?? 'N/A'}% (${todayDay.shSunsetText || 'N/A'})\n` +
      (todayDay.sunDirection !== null ? `Sun direction at golden hour: ${Math.round(todayDay.sunDirection!)}°\n` : '') +
      (todayDay.crepRayPeak > 0 ? `Crepuscular ray potential: ${todayDay.crepRayPeak}/100` : '')
    : '';
  const moonNote = moonTimingNote(todayDay);

  const astroAlternatives = (altLocations || []).filter(location => location.isAstroWin);
  const goldenHourAlternatives = (altLocations || []).filter(location => !location.isAstroWin);
  const altText = altLocations && altLocations.length
    ? `\nNearby alternatives worth considering:\n${[
      alternativePromptSection('Astro alternatives', astroAlternatives),
      alternativePromptSection('Golden-hour alternatives', goldenHourAlternatives),
    ].filter(Boolean).join('\n')}`
    : '';

  let prompt: string;

  if (effectiveDontBother) {
    const topAlt = topAlternativeLine(altLocations);
    const lhStr = topAlt
      ? ` The nearest meaningful alternative is ${topAlt}.`
      : '';
    const noWindowNote = !hasLocalWindow && (todayDay?.astroScore ?? 0) > 0
      ? ` Leeds may show some theoretical astro potential (${todayDay?.astroScore}/100 raw), but no local window cleared the full weighted threshold.`
      : '';
    prompt = `Photography assistant for Leeds, Yorkshire. Today is poor (score: ${todayBestScore}/100).
Respond with ONLY a raw JSON object — no markdown, no code fences:
{"editorial":"<exactly 2 sentences, max 45 words — sentence 1: why Leeds is not worth it today; sentence 2: best nearby alternative if provided>","composition":[],"weekStandout":"<1 sentence max 30 words — if one day scores clearly higher, call it standout; if a day wins only on certainty while another scores higher, call it most reliable and name the higher-scoring day>","spurOfTheMoment":{"locationName":"<exact name from list>","hookLine":"<1 sentence ≤25 words>","confidence":<0.0-1.0>}}

Do not include camera tips, composition advice, filler, hype, or emojis in the editorial.
${seasonalNote ? `Seasonal context: ${seasonalNote}\n` : ''}${auroraNote ? `${auroraNote}\n` : ''}${shInfo}${moonNote}${confNote}${lhStr}${noWindowNote}
5-day outlook: ${weekLine}

SPUR OF THE MOMENT — pick one location from this list that would reward a spontaneous drive today given today's season and conditions. Copy the name exactly as shown. hookLine: 1 evocative sentence, ≤25 words, no scores, no drive times, no "Leeds". confidence: 0.7+ only when the fit is clear and specific; omit the spurOfTheMoment key entirely if nothing stands out. Do not pick locations from the 'Nearby alternatives' section.
Locations: ${SPUR_LOCATION_NAMES}`;
  } else {
    const bestHour = windows[0]?.hours?.find(h => h.score === windows[0].peak) || windows[0]?.hours?.[0];
    const bestWin = windows[0];
    const nextWin = windows[1];
    const topAlt = altLocations?.[0];
    const bestAltDelta = topAlt ? topAlt.bestScore - (bestWin?.peak || 0) : 0;
    const astroGap = todayDay && bestWin
      ? explainAstroScoreGap({ window: bestWin, today: todayDay })
      : null;
    const fallbackNote = bestWin?.fallback
      ? `\nTiming note: this is the most promising narrow stretch rather than a clean standout window.`
      : '';

    const crepNote = (bestHour?.crepuscular || 0) > 45
      ? `\nCrepuscular ray potential at best window: ${bestHour!.crepuscular}/100 — broken low cloud + low sun angle suggest shafts of light are possible.`
      : '';
    const shQNote = bestHour?.shQ !== null && bestHour?.shQ !== undefined
      ? `\nSunsetHue quality for this session: ${Math.round(bestHour!.shQ! * 100)}%`
      : '';
    const editorialInsights = [
      windowTrendInsight(bestWin),
      astroGap
        ? `- ${astroGap.text}`
        : '',
      bestAltDelta >= 10 && topAlt
        ? `- Consider ${topAlt.name} today${topAlt.darkSky ? ' — better dark sky conditions' : ' — better overall conditions'}${topAlt.driveMins ? ` (${topAlt.driveMins} min drive)` : ''}.`
        : '',
      nextWin && bestWin && isAstroWindow(bestWin) && isAstroWindow(nextWin)
        ? `- If you miss the first slot, ${nextWin.label.toLowerCase()} is the later, darker fallback from ${nextWin.start}\u2013${nextWin.end}.`
        : '',
    ].filter(Boolean).join('\n');

    const shotConstraints = skyQualityConstraints(
      now.getMonth() + 1,
      moonPct,
      topAlt,
      isAstroWindow(bestWin),
    );

    const windowsText = windows.map((w, i) => {
      const h = w.hours?.find(x => x.score === w.peak) || w.hours?.[0];
      return `${i + 1}. ${w.label} (${windowRange(w)}) \u2014 ${w.peak}/100${w.fallback ? ' [narrow best chance]' : ''}
   Cloud: lo${h?.cl}% mid${h?.cm}% hi${h?.ch}% | Vis ${Math.round(h?.visK ?? 0)}km | Wind ${h?.wind}km/h | Rain ${h?.pp}%${(h?.crepuscular ?? 0) > 30 ? ' | Ray potential: ' + h!.crepuscular + '/100' : ''}
   Tags: ${(w.tops || []).join(', ')}`;
    }).join('\n\n');

    prompt = `You are an expert landscape and astrophotography assistant giving a daily photography briefing for Leeds, West Yorkshire.
Respond with ONLY a raw JSON object — no markdown, no code fences:
{"editorial":"<2 sentences max 55 words>","composition":["<shot idea 1>","<shot idea 2>"],"weekStandout":"<1 sentence max 30 words>","spurOfTheMoment":{"locationName":"<exact name from list>","hookLine":"<1 sentence ≤25 words>","confidence":<0.0-1.0>}}

EDITORIAL (exactly 2 sentences, max 55 words total):
Sentence 1: explain why the best local window is worth attention using one supplied fact about timing, change, darkness, or trend.
Sentence 2: use one editorial insight line below with light paraphrase. Do not invent a different second sentence.
The window card already shows the label, time range, score, and headline metrics. Do not open by repeating the visible window name, time, score, or visibility line.
Use only supplied facts. No camera tips, composition advice, hype, or filler. No emojis. Never return a single sentence. Do not call conditions ideal unless score ≥ 70.
When an insight line mentions a nearby alternative, use a prose recommendation only — no score numbers, point deltas, or '/100' references in the editorial. All metric detail is in the alternative card below.

COMPOSITION (2 short bullet items):
Suggest 2 concrete shot ideas for the best window. Each must name a specific subject or technique suited to these conditions. No generic tips.
${shotConstraints ? `\n${shotConstraints}\n` : ''}
WEEK STANDOUT (1 sentence, max 30 words):
If one day scores clearly higher than others, call it the "standout" day. If today wins only on certainty (lower spread) while another day scores higher, call today the "most reliable" day and briefly name the higher-scoring day with its uncertainty (e.g. "Today is the most reliable forecast; Wednesday may score higher but with much lower certainty").

SPUR OF THE MOMENT — pick one location from this list that would reward a spontaneous drive today given today's season and conditions. Copy the name exactly as shown. hookLine: 1 evocative sentence, ≤25 words, no scores, no drive times, no "Leeds". confidence: 0.7+ only when the fit is clear and specific; omit the spurOfTheMoment key entirely if nothing stands out. Do not pick locations from the 'Nearby alternatives' section.
Locations: ${SPUR_LOCATION_NAMES}

Date: ${today} | Sunrise: ${sunriseStr} | Sunset: ${sunsetStr} | Moon: ${moonPct}%
${seasonalNote ? `Seasonal context: ${seasonalNote}\n` : ''}${auroraNote ? `${auroraNote}\n` : ''}${shInfo}${moonNote}${crepNote}${shQNote}${confNote}${fallbackNote}
${metarNote ? 'METAR: ' + metarNote : ''}
${editorialInsights ? `\nEditorial insight options:\n${editorialInsights}` : ''}

Leeds shooting windows:
${windowsText}${altText}
5-day outlook: ${weekLine}`;
  }

  return {
    prompt,
    dontBother: effectiveDontBother,
    windows,
    todayCarWash,
    dailySummary,
    altLocations,
    noAltsMsg,
    sunriseStr,
    sunsetStr,
    moonPct,
    metarNote,
    today,
    todayBestScore,
    shSunsetQ: todayDay?.shSunsetQuality ?? null,
    shSunriseQ: todayDay?.shSunriseQuality ?? null,
    shSunsetText: todayDay?.shSunsetText ?? null,
    sunDir: todayDay?.sunDirection ?? null,
    crepPeak: todayDay?.crepRayPeak || 0,
    peakKpTonight,
    debugContext,
  };
}
