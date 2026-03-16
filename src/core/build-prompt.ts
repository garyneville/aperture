import type { Window, DailySummary, CarWash } from './best-windows.js';
import { LONG_RANGE_LOCATIONS } from './long-range-locations.js';
import { PHOTO_BRIEF_WORKFLOW_VERSION, getPhotoWeatherLat, getPhotoWeatherLocation, getPhotoWeatherLon, getPhotoWeatherTimezone } from '../config.js';
import { emptyDebugContext, type DebugContext } from './debug-context.js';

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

  const altText = altLocations && altLocations.length
    ? `\nNearby alternatives worth considering:\n` +
      altLocations.slice(0, 3).map(l =>
        `- ${l.name} (${l.driveMins}min): ${l.bestScore}/100` +
        (l.isAstroWin
          ? ` ${l.bestAstroHour ? `best astro ${l.bestAstroHour}` : 'astrophotography'}${l.darkSky ? ' (dark sky)' : ''}`
          : ` best at ${l.bestDayHour}`)
      ).join('\n')
    : '';

  let prompt: string;

  if (dontBother) {
    const topAlt = topAlternativeLine(altLocations);
    const lhStr = topAlt
      ? ` The nearest meaningful alternative is ${topAlt}.`
      : '';
    prompt = `Photography assistant for Leeds, Yorkshire. Today is poor (score: ${todayBestScore}/100).
Respond with ONLY a raw JSON object — no markdown, no code fences:
{"editorial":"<exactly 2 sentences, max 45 words — sentence 1: why Leeds is not worth it today; sentence 2: best nearby alternative if provided>","composition":[],"weekStandout":"<1 sentence max 30 words — if one day scores clearly higher, call it standout; if a day wins only on certainty while another scores higher, call it most reliable and name the higher-scoring day>","spurOfTheMoment":{"locationName":"<exact name from list>","hookLine":"<1 sentence ≤25 words>","confidence":<0.0-1.0>}}

Do not include camera tips, composition advice, filler, hype, or emojis in the editorial.
${seasonalNote ? `Seasonal context: ${seasonalNote}\n` : ''}${auroraNote ? `${auroraNote}\n` : ''}${shInfo}${moonNote}${confNote}${lhStr}
5-day outlook: ${weekLine}

SPUR OF THE MOMENT — pick one location from this list that would reward a spontaneous drive today given today's season and conditions. Copy the name exactly as shown. hookLine: 1 evocative sentence, ≤25 words, no scores, no drive times, no "Leeds". confidence: 0.7+ only when the fit is clear and specific; omit the spurOfTheMoment key entirely if nothing stands out.
Locations: ${SPUR_LOCATION_NAMES}`;
  } else {
    const bestHour = windows[0]?.hours?.find(h => h.score === windows[0].peak) || windows[0]?.hours?.[0];
    const bestWin = windows[0];
    const nextWin = windows[1];
    const topAlt = altLocations?.[0];
    const bestAltDelta = topAlt ? topAlt.bestScore - (bestWin?.peak || 0) : 0;
    const overallAstroDelta = todayDay && bestWin ? (todayDay.astroScore ?? 0) - bestWin.peak : 0;
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
      overallAstroDelta >= 10
        ? `- Overall astro potential is ${todayDay?.astroScore ?? 0}/100 - the window score is held back by conditions outside the named window.`
        : '',
      bestAltDelta >= 10 && topAlt
        ? `- ${topAlt.name} is ${bestAltDelta} points stronger${topAlt.darkSky ? ' mainly because of darker skies' : ''}${topAlt.bestAstroHour ? ` around ${topAlt.bestAstroHour}` : ''}.`
        : '',
      nextWin && bestWin && isAstroWindow(bestWin) && isAstroWindow(nextWin)
        ? `- If you miss the first slot, ${nextWin.label.toLowerCase()} is the later, darker fallback from ${nextWin.start}\u2013${nextWin.end}.`
        : '',
    ].filter(Boolean).join('\n');

    const windowsText = windows.map((w, i) => {
      const h = w.hours?.find(x => x.score === w.peak) || w.hours?.[0];
      return `${i + 1}. ${w.label} (${windowRange(w)}) \u2014 ${w.peak}/100${w.fallback ? ' [narrow best chance]' : ''}
   Cloud: lo${h?.cl}% mid${h?.cm}% hi${h?.ch}% | Vis ${h?.visK}km | Wind ${h?.wind}km/h | Rain ${h?.pp}%${(h?.crepuscular ?? 0) > 30 ? ' | Ray potential: ' + h!.crepuscular + '/100' : ''}
   Tags: ${(w.tops || []).join(', ')}`;
    }).join('\n\n');

    prompt = `You are an expert landscape and astrophotography assistant giving a daily photography briefing for Leeds, West Yorkshire.
Respond with ONLY a raw JSON object — no markdown, no code fences:
{"editorial":"<2 sentences max 55 words>","composition":["<shot idea 1>","<shot idea 2>"],"weekStandout":"<1 sentence max 30 words>","spurOfTheMoment":{"locationName":"<exact name from list>","hookLine":"<1 sentence ≤25 words>","confidence":<0.0-1.0>}}

EDITORIAL (2 sentences, max 55 words total):
Sentence 1: name the best local window exactly as labelled, include its time and score, add one useful detail (peak time or how session changes).
Sentence 2: use one editorial insight line below with light paraphrase. Do not invent a different second sentence.
Use only supplied facts. No camera tips, composition advice, hype, or filler. No emojis. Do not call conditions ideal unless score ≥ 70.

COMPOSITION (2 short bullet items):
Suggest 2 concrete shot ideas for the best window. Each must name a specific subject or technique suited to these conditions. No generic tips.

WEEK STANDOUT (1 sentence, max 30 words):
If one day scores clearly higher than others, call it the "standout" day. If today wins only on certainty (lower spread) while another day scores higher, call today the "most reliable" day and briefly name the higher-scoring day with its uncertainty (e.g. "Today is the most reliable forecast; Wednesday may score higher but with much lower certainty").

SPUR OF THE MOMENT — pick one location from this list that would reward a spontaneous drive today given today's season and conditions. Copy the name exactly as shown. hookLine: 1 evocative sentence, ≤25 words, no scores, no drive times, no "Leeds". confidence: 0.7+ only when the fit is clear and specific; omit the spurOfTheMoment key entirely if nothing stands out.
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
    dontBother,
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
