import { LONG_RANGE_LOCATIONS } from '../../../../lib/long-range-locations.js';
import type { AltLocationResult } from '../build-prompt.js';
import type { DailySummary } from '../../../windowing/best-windows.js';
import { topAlternativeLine } from './alternatives.js';
import {
  buildEditorialResponseContractText,
  buildSpurInstructions,
  buildWeekStandoutInstructions,
  type StructuredPromptParts,
} from './prompt-blocks.js';

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

  const responseContract = buildEditorialResponseContractText({
    homeLocationName: p.homeLocationName,
    variant: 'dont-bother',
    maxWords: 45,
  });

  return `Photography assistant for ${p.homeLocationName}. Today is poor (score: ${p.todayBestScore}/100).
${responseContract}

Do not include camera tips, composition advice, filler, hype, or emojis in the editorial.
${p.seasonalNote ? `Seasonal context: ${p.seasonalNote}\n` : ''}${p.auroraNote ? `${p.auroraNote}\n` : ''}${p.shInfo}${p.moonNote}${p.confNote}${lhStr}${noWindowNote}
5-day outlook: ${p.weekLine}

${buildWeekStandoutInstructions()}

${buildSpurInstructions({ homeLocationName: p.homeLocationName, locationList: SPUR_LOCATION_NAMES })}`;
}

export function buildStructuredDontBotherPrompt(p: DontBotherPromptParams): StructuredPromptParts {
  const topAlt = topAlternativeLine(p.altLocations);
  const lhStr = topAlt
    ? `The nearest meaningful alternative is ${topAlt}.`
    : 'No nearby alternative cleared the recommendation threshold.';
  const noWindowNote = !p.hasLocalWindow && (p.todayDay?.astroScore ?? 0) > 0
    ? `${p.homeLocationName} may show some theoretical astro potential (${p.todayDay?.astroScore}/100 raw), but no local window cleared the full weighted threshold.`
    : '';

  const systemPrompt = `You are a photography briefing assistant for ${p.homeLocationName}.
Return JSON that matches the supplied schema exactly.

EDITORIAL RULES
- editorial must be exactly 2 sentences and no more than 45 words total.
- Sentence 1 must explain why ${p.homeLocationName} is not worth it today.
- Sentence 2 should name the best nearby alternative only when the user message supplies one.
- Use only supplied facts.
- No camera tips, composition advice, hype, filler, or emojis.

COMPOSITION RULES
- composition must be an empty array.

WEEK STANDOUT RULES
${buildWeekStandoutInstructions()}

SPUR OF THE MOMENT RULES
- Pick only from the long-range location list in the user message.
- Do not pick locations from the nearby alternatives section.
- hookLine must be 1 evocative sentence, 25 words or fewer, with no scores, drive times, or mention of ${p.homeLocationName}.
- Use confidence 0.7 or higher only when the fit is clear and specific.
- If nothing stands out, return spurOfTheMoment with locationName "", hookLine "", and confidence 0.`;

  const userPrompt = `Today is poor for ${p.homeLocationName} (score: ${p.todayBestScore}/100).
${p.seasonalNote ? `Seasonal context: ${p.seasonalNote}\n` : ''}${p.auroraNote ? `${p.auroraNote}\n` : ''}${p.shInfo}${p.moonNote}${p.confNote}${lhStr ? `${lhStr}\n` : ''}${noWindowNote ? `${noWindowNote}\n` : ''}5-day outlook: ${p.weekLine}

Nearby alternatives summary:
${topAlt || 'None'}

Long-range locations for spurOfTheMoment:
${SPUR_LOCATION_NAMES}`;

  return {
    systemPrompt,
    userPrompt,
  };
}
