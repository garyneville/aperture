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
        (l.isAstroWin ? ` astrophotography${l.darkSky ? ' (dark sky)' : ''}` : ` best at ${l.bestDayHour}`)
      ).join('\n')
    : '';

  let prompt: string;

  if (dontBother) {
    const lhStr = altLocations?.length
      ? ` The nearest alternative scoring well is ${altLocations[0].name} (${altLocations[0].driveMins}min, ${altLocations[0].bestScore}/100${altLocations[0].bestDayHour ? ' at ' + altLocations[0].bestDayHour : ''}).`
      : '';
    prompt = `Photography assistant for Leeds, Yorkshire. Today is poor (score: ${todayBestScore}/100).
One dry sentence why it's not worth going out. Then one sentence max about the best nearby alternative if there is one. No emojis.
${shInfo}${confNote}${lhStr}`;
  } else {
    const bestHour = windows[0]?.hours?.find(h => h.score === windows[0].peak) || windows[0]?.hours?.[0];
    const bestWin = windows[0];
    const fallbackNote = bestWin?.fallback
      ? `\nTiming note: this is the most promising narrow stretch rather than a clean standout window.`
      : '';

    const crepNote = (bestHour?.crepuscular || 0) > 45
      ? `\nCrepuscular ray potential at best window: ${bestHour!.crepuscular}/100 — broken low cloud + low sun angle suggest shafts of light are possible.`
      : '';
    const shQNote = bestHour?.shQ !== null && bestHour?.shQ !== undefined
      ? `\nSunsetHue quality for this session: ${Math.round(bestHour!.shQ! * 100)}%`
      : '';

    const windowsText = windows.map((w, i) => {
      const h = w.hours?.find(x => x.score === w.peak) || w.hours?.[0];
      return `${i + 1}. ${w.label} (${w.start}\u2013${w.end}) \u2014 ${w.peak}/100${w.fallback ? ' [narrow best chance]' : ''}
   Cloud: lo${h?.cl}% mid${h?.cm}% hi${h?.ch}% | Vis ${h?.visK}km | Wind ${h?.wind}km/h | Rain ${h?.pp}%${(h?.crepuscular ?? 0) > 30 ? ' | Ray potential: ' + h!.crepuscular + '/100' : ''}
   Tags: ${(w.tops || []).join(', ')}`;
    }).join('\n\n');

    prompt = `You are an expert landscape and astrophotography assistant giving a daily photography briefing for Leeds, West Yorkshire.
Write 2\u20133 concise sentences. Be direct and specific. Cover: (1) the best window and why the light works, (2) one practical tip \u2014 composition, subject, or technique. Dry but enthusiastic tone. No emojis, no padding.

Date: ${today} | Sunrise: ${sunriseStr} | Sunset: ${sunsetStr} | Moon: ${moonPct}%
${shInfo}${crepNote}${shQNote}${confNote}${fallbackNote}
${metarNote ? 'METAR: ' + metarNote : ''}

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
