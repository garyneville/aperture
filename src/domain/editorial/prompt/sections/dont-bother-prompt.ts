import { LONG_RANGE_LOCATIONS } from '../../../../lib/long-range-locations.js';
import type { AltLocationResult } from '../build-prompt.js';
import type { DailySummary } from '../../../windowing/best-windows.js';
import { topAlternativeLine } from './alternatives.js';
import { weekStandoutSchemaHint, weekStandoutInstructionBlock } from './week-standout.js';

const SPUR_LOCATION_NAMES = LONG_RANGE_LOCATIONS.map(l => l.name).join(', ');

export interface DontBotherPromptParams {
  homeLocationName: string;
  todayBestScore: number;
  seasonalNote: string;
  auroraNote: string;
  shInfo: string;
  moonNote: string;
  confNote: string;
  altLocations?: AltLocationResult[];
  weekLine: string;
  todayDay: DailySummary | undefined;
  hasLocalWindow: boolean;
}

export function buildDontBotherPrompt(p: DontBotherPromptParams): string {
  const topAlt = topAlternativeLine(p.altLocations);
  const lhStr = topAlt
    ? ` The nearest meaningful alternative is ${topAlt}.`
    : '';
  const noWindowNote = !p.hasLocalWindow && (p.todayDay?.astroScore ?? 0) > 0
    ? ` ${p.homeLocationName} may show some theoretical astro potential (${p.todayDay?.astroScore}/100 raw), but no local window cleared the full weighted threshold.`
    : '';

  return `Photography assistant for ${p.homeLocationName}. Today is poor (score: ${p.todayBestScore}/100).
Respond with ONLY a raw JSON object — no markdown, no code fences:
{"editorial":"<exactly 2 sentences, max 45 words — sentence 1: why ${p.homeLocationName} is not worth it today; sentence 2: best nearby alternative if provided>","composition":[],"weekStandout":"${weekStandoutSchemaHint()}","spurOfTheMoment":{"locationName":"<exact name from list>","hookLine":"<1 sentence ≤25 words>","confidence":<0.0-1.0>}}

Do not include camera tips, composition advice, filler, hype, or emojis in the editorial.
${p.seasonalNote ? `Seasonal context: ${p.seasonalNote}\n` : ''}${p.auroraNote ? `${p.auroraNote}\n` : ''}${p.shInfo}${p.moonNote}${p.confNote}${lhStr}${noWindowNote}
5-day outlook: ${p.weekLine}

${weekStandoutInstructionBlock()}

SPUR OF THE MOMENT — pick one location from this list that would reward a spontaneous drive today given today's season and conditions. Copy the name exactly as shown. hookLine: 1 evocative sentence, ≤25 words, no scores, no drive times, no "${p.homeLocationName}". confidence: 0.7+ only when the fit is clear and specific; omit the spurOfTheMoment key entirely if nothing stands out. Do not pick locations from the 'Nearby alternatives' section.
Locations: ${SPUR_LOCATION_NAMES}`;
}
