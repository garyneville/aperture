/**
 * Time-aware email rendering for photo briefings.
 *
 * This module handles email-specific rendering of time-aware briefing content.
 * It focuses on assembling the final email output, delegating card rendering
 * to window-cards.ts and shared helpers to window-helpers.ts.
 */

import { renderAiBriefingText } from '../../domain/editorial/ai-briefing.js';
import { esc } from '../../lib/utils.js';
import {
  C,
  FONT,
  card,
  htmlText,
  listRows,
  scorePill,
} from './shared.js';
import type {
  AltLocation,
  DaySummary,
  RunTimeContext,
  Window,
} from '../../contracts/index.js';
import {
  buildWindowDisplayPlan,
  classifyWindowTiming,
  timeAwareBriefingFallback,
} from '../../domain/windowing/index.js';
import { windowCard, compositionCard, poorDayFallbackLine } from './window-cards.js';

export function todayWindowSection(
  dontBother: boolean,
  todayBestScore: number,
  aiText: string,
  windows: Window[] | undefined,
  dailySummary: DaySummary[],
  altLocations: AltLocation[] | undefined,
  runTime: RunTimeContext,
  peakKpTonight: number | null | undefined,
  compositionBullets?: string[],
  homeLatitude?: number | null,
  homeLocationName?: string | null,
): string {
  const hasLocalWindow = (windows?.length || 0) > 0;
  const effectiveDontBother = dontBother || !hasLocalWindow;
  const displayPlan = buildWindowDisplayPlan(windows, runTime.nowMinutes);

  if (effectiveDontBother) {
    const headline = hasLocalWindow ? 'Not worth shooting locally' : 'No clear local window';
    return card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.error};">Today&apos;s call</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:600;line-height:1.24;letter-spacing:-0.01em;color:${C.ink};">${headline}</div>
      <div style="Margin-top:10px;">${scorePill(todayBestScore)}</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(poorDayFallbackLine(windows))}</div>
    `, '', `border-top:3px solid ${C.error};`);
  }

  const fallbackAiText = timeAwareBriefingFallback(displayPlan);
  const renderedAi = fallbackAiText
    ? { text: fallbackAiText, strippedOpener: false, usedFallback: true }
    : renderAiBriefingText(aiText, { dontBother, windows, dailySummary, altLocations, peakKpTonight, homeLatitude, homeLocationName });
  const trimmedAiText = renderedAi.text || aiText;
  const compCard = fallbackAiText ? '' : compositionCard(compositionBullets || []);
  const displayedWindows: string[] = [];

  if (!displayPlan.allPast && displayPlan.primary) {
    const primaryLabel = displayPlan.promotedFromPast
      ? 'Next window'
      : classifyWindowTiming(displayPlan.primary, runTime.nowMinutes) === 'current'
        ? 'Live now'
        : 'Best window';
    displayedWindows.push(windowCard(
      displayPlan.primary,
      0,
      [displayPlan.primary, ...displayPlan.remaining.filter(window => window !== displayPlan.primary)],
      primaryLabel,
      peakKpTonight,
      homeLatitude,
    ));
    displayPlan.remaining
      .filter(window => window !== displayPlan.primary)
      .forEach((window, index) => {
        displayedWindows.push(windowCard(window, index + 1, displayPlan.remaining, 'Later today', peakKpTonight, homeLatitude));
      });
  }

  displayPlan.past.forEach((window, index) => {
    displayedWindows.push(windowCard(window, index + 1, displayPlan.past, 'Earlier today', peakKpTonight, homeLatitude));
  });

  return listRows([
    ...displayedWindows,
    card(`
      <div style="Margin:0 0 8px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:${C.subtle};">AI briefing</div>
      ${htmlText(trimmedAiText)}
    `),
    ...(compCard ? [compCard] : []),
  ]);
}
