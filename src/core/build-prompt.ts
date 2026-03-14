import type { Window, DailySummary, CarWash } from './best-windows.js';

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
  now?: Date;
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

function windowTrendInsight(window: Window | undefined): string {
  if (!window?.hours?.length) return '';
  const peakHour = peakHourForWindow(window);
  if (!peakHour) return '';

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

export function buildPrompt(input: BuildPromptInput): BuildPromptOutput {
  const {
    windows, dontBother, todayBestScore, todayCarWash,
    dailySummary, altLocations, noAltsMsg, metarNote,
    sunrise, sunset, moonPct,
  } = input;

  const now = input.now || new Date();

  const sunriseStr = sunrise
    ? new Date(sunrise).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
    : '--:--';
  const sunsetStr = sunset
    ? new Date(sunset).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
    : '--:--';
  const today = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London',
  });

  const todayDay = dailySummary[0];

  const confNote = todayDay?.confidence && todayDay.confidence !== 'unknown'
    ? `\nForecast certainty: ${confidenceLabel(todayDay.confidence)}.` +
      `${todayDay.confidenceStdDev !== null ? ` Forecast models differ by about ${todayDay.confidenceStdDev} cloud-cover points during the key shooting hours.` : ''}`
    : '';

  const shInfo = todayDay
    ? `SunsetHue golden-hour quality — sunrise: ${todayDay.shSunriseQuality ?? 'N/A'}% | sunset: ${todayDay.shSunsetQuality ?? 'N/A'}% (${todayDay.shSunsetText || 'N/A'})\n` +
      (todayDay.sunDirection !== null ? `Sun direction at golden hour: ${Math.round(todayDay.sunDirection!)}°\n` : '') +
      (todayDay.crepRayPeak > 0 ? `Crepuscular ray potential: ${todayDay.crepRayPeak}/100` : '')
    : '';

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
Write exactly 2 short sentences, maximum 45 words total.
Sentence 1: say plainly why Leeds is not worth it locally, using only the provided weather facts.
Sentence 2: mention the best nearby alternative only if one is provided.
Do not include camera tips, composition advice, filler, hype, or emojis.
${shInfo}${confNote}${lhStr}`;
  } else {
    const bestHour = windows[0]?.hours?.find(h => h.score === windows[0].peak) || windows[0]?.hours?.[0];
    const bestWin = windows[0];
    const nextWin = windows[1];
    const topAlt = altLocations?.[0];
    const bestAltDelta = topAlt ? topAlt.bestScore - (bestWin?.peak || 0) : 0;
    const overallAstroDelta = todayDay && bestWin ? (todayDay.astroScore ?? 0) - bestWin.peak : 0;
    const peakHour = peakHourForWindow(bestWin);
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
        ? `- Overall astro potential is ${todayDay?.astroScore ?? 0}/100 - the window score is held back by weaker conditions earlier in the session${peakHour ? ` before the ${peakHour} local peak` : ''}.`
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
      return `${i + 1}. ${w.label} (${w.start}\u2013${w.end}) \u2014 ${w.peak}/100${w.fallback ? ' [narrow best chance]' : ''}
   Cloud: lo${h?.cl}% mid${h?.cm}% hi${h?.ch}% | Vis ${h?.visK}km | Wind ${h?.wind}km/h | Rain ${h?.pp}%${(h?.crepuscular ?? 0) > 30 ? ' | Ray potential: ' + h!.crepuscular + '/100' : ''}
   Tags: ${(w.tops || []).join(', ')}`;
    }).join('\n\n');

    prompt = `You are an expert landscape and astrophotography assistant giving a daily photography briefing for Leeds, West Yorkshire.
Write exactly 2 short sentences, maximum 55 words total.
Sentence 1 must make the local call, name the best local window exactly as labelled, include its time and score, and add one useful detail beyond the raw card - usually the peak time within the window or how the session changes.
Sentence 2 must use one of the editorial insight lines below with only light paraphrase. Do not invent a different second sentence.
Use only the supplied facts. Do not add camera tips, composition advice, technique advice, hype, or generic filler. Do not call conditions ideal unless the score is at least 70. No emojis. Do not simply restate cloud, visibility, wind, rain, the time range, or the score from the card unless needed to explain a trend.

Date: ${today} | Sunrise: ${sunriseStr} | Sunset: ${sunsetStr} | Moon: ${moonPct}%
${shInfo}${crepNote}${shQNote}${confNote}${fallbackNote}
${metarNote ? 'METAR: ' + metarNote : ''}
${editorialInsights ? `\nEditorial insight options:\n${editorialInsights}` : ''}

Leeds shooting windows:
${windowsText}${altText}`;
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
  };
}
