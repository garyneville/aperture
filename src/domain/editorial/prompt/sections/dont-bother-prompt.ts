import { LONG_RANGE_LOCATIONS } from '../../../../lib/long-range-locations.js';
import type { AltLocationResult } from '../build-prompt.js';
import type { DailySummary } from '../../../windowing/best-windows.js';
import { topAlternativeLine } from './alternatives.js';
import {
  buildEditorialResponseContractText,
  buildSpurInstructions,
  buildWeekStandoutInstructions,
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
