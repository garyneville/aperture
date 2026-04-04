import { LONG_RANGE_LOCATIONS } from '../../../../lib/long-range-locations.js';
import { explainAstroScoreGap } from '../../astro-score-explanation.js';
import type { Window, DailySummary } from '../../../windowing/best-windows.js';
import type { AltLocationResult } from '../build-prompt.js';
import type { SessionRecommendationSummary } from '../../../../types/session-score.js';
import { alternativePromptSection } from './alternatives.js';
import { isAstroWindow, windowRange, windowTrendInsight } from './shared.js';
import { skyQualityConstraints } from './sky-quality-constraints.js';
import {
  buildEditorialResponseContractText,
  buildSpurInstructions,
  buildWeekStandoutInstructions,
} from './prompt-blocks.js';

const SPUR_LOCATION_NAMES = LONG_RANGE_LOCATIONS.map(l => l.name).join(', ');

export interface LocalWindowPromptParams {
  homeLocationName: string;
  windows: Window[];
  nowTimeStr: string;
  nowMinutes: number;
  today: string;
  sunriseStr: string;
  sunsetStr: string;
  moonPct: number;
  seasonalNote: string;
  auroraNote: string;
  shInfo: string;
  moonNote: string;
  confNote: string;
  metarNote: string;
  weekLine: string;
  altLocations?: AltLocationResult[];
  todayDay: DailySummary | undefined;
  auroraVisibleLocally: boolean;
  auroraThreshold: number;
  peakKpTonight: number | null;
  currentMonth: number;
  sessionRecommendation?: SessionRecommendationSummary;
}

function clockToMinsLocal(t: string | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

export function buildLocalWindowPrompt(p: LocalWindowPromptParams): string {
  const {
    homeLocationName, windows, nowTimeStr, nowMinutes, today,
    sunriseStr, sunsetStr, moonPct,
    seasonalNote, auroraNote, shInfo, moonNote, confNote, metarNote,
    weekLine, altLocations, todayDay,
    auroraVisibleLocally, auroraThreshold, peakKpTonight, currentMonth,
  } = p;

  const upcomingWindows = windows.filter(w => {
    const end = clockToMinsLocal(w.end);
    return end === null || end >= nowMinutes;
  });
  const primaryWindowIsPast = upcomingWindows.length < windows.length && upcomingWindows[0] !== windows[0];
  const bestWin = upcomingWindows[0] ?? windows[0];
  const bestHour = bestWin?.hours?.find(h => h.score === bestWin.peak) || bestWin?.hours?.[0];
  const nextWin = upcomingWindows[1] ?? null;
  const temporalContext = primaryWindowIsPast
    ? `TEMPORAL CONTEXT: It is now ${nowTimeStr}. The original primary window (${windows[0].label} ${windowRange(windows[0])}) has already passed. ${bestWin && bestWin !== windows[0] ? `Your editorial must focus on the next upcoming window: ${bestWin.label} (${windowRange(bestWin)}). Do not advise preparing for the past window.` : 'No further local windows remain today. Note this in your editorial.'}\n`
    : '';
  const topAlt = altLocations?.[0];
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
    auroraVisibleLocally && isAstroWindow(bestWin)
      ? `- This window coincides with an active aurora signal (Kp ${peakKpTonight?.toFixed(1) ?? 'unknown'} vs local visibility threshold Kp ${auroraThreshold}), so a clean northern horizon matters.`
      : '',
    nextWin && bestWin && isAstroWindow(bestWin) && isAstroWindow(nextWin)
      ? `- If you miss the first slot, ${nextWin.label.toLowerCase()} is the later, darker fallback from ${nextWin.start}\u2013${nextWin.end}.`
      : '',
  ].filter(Boolean).join('\n');

  const shotConstraints = skyQualityConstraints(
    homeLocationName,
    currentMonth,
    moonPct,
    topAlt,
    isAstroWindow(bestWin),
    auroraVisibleLocally,
    auroraThreshold,
    peakKpTonight,
  );

  const windowsText = windows.map((w, i) => {
    const h = w.hours?.find(x => x.score === w.peak) || w.hours?.[0];
    const aodLine = typeof h?.aod === 'number' && h.aod >= 0.12 ? ` | AOD ${h.aod.toFixed(2)}` : '';
    return `${i + 1}. ${w.label} (${windowRange(w)}) \u2014 ${w.peak}/100${w.fallback ? ' [narrow best chance]' : ''}
   Cloud: lo${h?.cl}% mid${h?.cm}% hi${h?.ch}% | Vis ${Math.round(h?.visK ?? 0)}km${aodLine} | Wind ${h?.wind}km/h | Rain ${h?.pp}%${(h?.crepuscular ?? 0) > 30 ? ' | Ray potential: ' + h!.crepuscular + '/100' : ''}
   Tags: ${(w.tops || []).join(', ')}`;
  }).join('\n\n');

  const astroAlternatives = (altLocations || []).filter(location => location.isAstroWin);
  const goldenHourAlternatives = (altLocations || []).filter(location => !location.isAstroWin);
  const altText = altLocations && altLocations.length
    ? `\nNearby alternatives worth considering:\n${[
      alternativePromptSection('Nearby astro options', astroAlternatives),
      alternativePromptSection('Nearby landscape options', goldenHourAlternatives),
    ].filter(Boolean).join('\n')}`
    : '';

  const responseContract = buildEditorialResponseContractText({
    homeLocationName,
    variant: 'local-window',
  });

  return `You are an expert landscape and astrophotography assistant giving a daily photography briefing for ${homeLocationName}.
${responseContract}

EDITORIAL (exactly 2 sentences, max 55 words total):
Selected primary window: ${bestWin.label} (${windowRange(bestWin)}). Your editorial must reference this window by name or time range. Do not describe conditions outside this window unless making a direct comparison.
Sentence 1: explain why the best local window is worth attention using one supplied fact about timing, change, darkness, or trend.
Sentence 2: use one editorial insight line below with light paraphrase. Do not invent a different second sentence.
The window card already shows the label, time range, score, and headline metrics. Do not open by repeating the visible window name, time, score, or visibility line.
Use only supplied facts. No camera tips, composition advice, hype, or filler. No emojis. Never return a single sentence. Do not call conditions ideal unless score ≥ 70.
Do not blame cloud unless the supplied peak-hour cloud cover supports it. If the score gap is explained by visibility or AOD, say that instead.
The editorial must describe ${homeLocationName} conditions only. Do not name or reference any nearby alternative location, score, or comparison. All alternative detail is in the dedicated card below.

COMPOSITION (2 short bullet items):
Suggest 2 concrete shot ideas for the best window. Each must name a specific subject or foreground candidate plus a framing cue, direction, or technique suited to these conditions.
Avoid generic placeholders like "silhouetted landmark foreground" or "wide-field constellation framing" unless the supplied constraints explicitly support them.
${shotConstraints ? `\n${shotConstraints}\n` : ''}
${buildWeekStandoutInstructions()}

${buildSpurInstructions({ homeLocationName, locationList: SPUR_LOCATION_NAMES })}

Date: ${today} | Current time: ${nowTimeStr} | Sunrise: ${sunriseStr} | Sunset: ${sunsetStr} | Moon: ${moonPct}%
${temporalContext}${seasonalNote ? `Seasonal context: ${seasonalNote}\n` : ''}${auroraNote ? `${auroraNote}\n` : ''}${shInfo}${moonNote}${crepNote}${shQNote}${confNote}${fallbackNote}
${metarNote ? 'METAR: ' + metarNote : ''}
${editorialInsights ? `\nEditorial insight options:\n${editorialInsights}` : ''}

${homeLocationName} shooting windows:
${windowsText}${altText}
5-day outlook: ${weekLine}`;
}
