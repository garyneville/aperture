import { esc } from '../../../lib/utils.js';
import { renderAiBriefingText } from '../../../lib/ai-briefing.js';
import { auroraVisibleKpThresholdForLat, isAuroraLikelyVisibleAtLat } from '../../../lib/aurora-visibility.js';
import { C, scoreState, type SummaryStat } from '../../shared/brief-primitives.js';
import {
  buildWindowDisplayPlan,
  classifyWindowTiming,
  timeAwareBriefingFallback,
  windowRange,
} from '../../../domain/windowing/index.js';
import {
  displayTag,
  isAstroWindow,
  peakHourForWindow,
} from '../../email/time-aware.js';
import type {
  AltLocation,
  DaySummary,
  RunTimeContext,
  Window,
  WindowHour,
} from '../../../types/brief.js';

function sPill(text: string, fg: string, bg: string, border: string): string {
  return `<span class="pill" style="color:${fg};background:${bg};border-color:${border};">${esc(text)}</span>`;
}

function sChip(label: string, value: string | number, tone?: string): string {
  const color = tone || C.primary;
  return `<span class="chip"><span class="chip-label" style="color:${color};">${esc(label)}</span>${value !== '' ? ` ${esc(String(value))}` : ''}</span>`;
}

function sScorePill(score: number, suffix?: string): string {
  const state = scoreState(score);
  const label = `${state.label} — ${score}/100${suffix ? ` ${suffix}` : ''}`;
  return `<span class="pill ${siteScoreClass(score)}">${esc(label)}</span>`;
}

function siteScoreClass(score: number): string {
  if (score >= 75) return 'score-excellent';
  if (score >= 58) return 'score-good';
  if (score >= 42) return 'score-marginal';
  return 'score-poor';
}

function sCard(
  inner: string,
  opts: { accentSide?: 'top' | 'left'; accentColor?: string; extraClass?: string } = {},
): string {
  const { accentSide, accentColor, extraClass = '' } = opts;
  const accentClass = accentSide === 'top' ? ' card--top' : accentSide === 'left' ? ' card--left' : '';
  const accentStyle = accentSide && accentColor ? ` style="border-${accentSide}-color:${accentColor};"` : '';
  return `<div class="card${accentClass}${extraClass ? ` ${extraClass}` : ''}"${accentStyle}>${inner}</div>`;
}

function sSection(title: string): string {
  return `<h2 class="section-heading">${esc(title)}</h2>`;
}

function sMetricRun(items: Array<{ label: string; value: string | number; tone?: string }>): string {
  return items.map((item, index) => {
    const color = item.tone || C.primary;
    const sep = index < items.length - 1 ? `<span class="metric-run-sep">&middot;</span>` : '';
    return `<span><span style="font-weight:600;color:${color};">${esc(item.label)}</span> ${esc(String(item.value))}</span>${sep}`;
  }).join('');
}

function sHtmlText(text: string): string {
  const safe = esc(text || '');
  return `<div class="ai-body">${
    safe
      .split(/\n{2,}/)
      .map(chunk => `<p>${chunk.replace(/\n/g, '<br>')}</p>`)
      .join('')
  }</div>`;
}

import { dewRiskEntry } from '../../shared/brief-primitives.js';

export interface WindowCardProps {
  window: Window;
  index: number;
  allWindows: Window[];
  sectionLabel: string;
  peakKpTonight?: number | null;
  homeLatitude?: number | null;
}

export function sWindowCard(props: WindowCardProps): string {
  const { window, index, allWindows, sectionLabel, peakKpTonight, homeLatitude } = props;
  const hour: WindowHour = window.hours?.find(e => e.score === window.peak) || window.hours?.[0] || {} as WindowHour;
  const notes: string[] = [];

  if (window.fallback) notes.push('Most promising narrow stretch rather than a clean standout window.');
  if ((hour.crepuscular || 0) > 45) notes.push(`Crepuscular ray potential: ${hour.crepuscular}/100 (light shafts through broken cloud).`);
  if (window.darkPhaseStart && window.postMoonsetScore !== null && window.postMoonsetScore !== undefined) {
    notes.push(`Dark from ${window.darkPhaseStart} — peak after moonset ${window.postMoonsetScore}/100.`);
  }
  if (index === 0 && isAstroWindow(window) && isAuroraLikelyVisibleAtLat(homeLatitude ?? 54, peakKpTonight)) {
    const threshold = auroraVisibleKpThresholdForLat(homeLatitude ?? 54);
    notes.push(`Coincides with an active aurora signal (Kp ${peakKpTonight?.toFixed(1) ?? 'unknown'} vs local threshold Kp ${threshold}) — favour a clean northern horizon.`);
  }
  if (index > 0 && isAstroWindow(allWindows[0]) && isAstroWindow(window) && allWindows[0]?.label !== window.label) {
    notes.push('Later, darker backup if you miss the first astro slot.');
  }

  const metricLine = sMetricRun([
    { label: 'Cloud high',  value: `${hour.ch ?? '—'}%`,    tone: C.primary },
    { label: 'Visibility',  value: `${hour.visK ?? '—'}km`, tone: C.secondary },
    { label: 'Wind',        value: `${hour.wind ?? '—'}km/h`, tone: C.tertiary },
    { label: 'Rain',        value: `${hour.pp ?? '—'}%`,    tone: C.error },
    ...dewRiskEntry(hour.tpw, hour.tmp),
  ]);

  const tagChips = (window.tops || []).length
    ? `<div class="chip-row" style="margin-top:10px;">${(window.tops || []).map(tag => sChip(displayTag(tag), '', C.primary)).join('')}</div>`
    : '';

  const noteBlock = notes.length
    ? `<div class="card-body" style="margin-top:10px;padding-top:12px;border-top:1px solid var(--c-outline);">${esc(notes.join(' '))}</div>`
    : '';

  return sCard(`
    <div class="card-overline">${esc(sectionLabel)}</div>
    <div class="card-headline">${esc(window.label)}</div>
    <div class="card-body" style="margin-top:4px;">${esc(windowRange(window))}</div>
    <div style="margin-top:10px;">${sScorePill(window.peak)}</div>
    <div class="metric-run" style="margin-top:10px;">${metricLine}</div>
    ${tagChips}
    ${noteBlock}
  `, { accentSide: index === 0 ? 'top' : undefined, accentColor: index === 0 ? scoreState(window.peak).fg : undefined });
}

export interface WindowSectionInput {
  dontBother: boolean;
  todayBestScore: number;
  aiText: string;
  windows: Window[] | undefined;
  dailySummary: DaySummary[];
  altLocations: AltLocation[] | undefined;
  runTime: RunTimeContext;
  peakKpTonight: number | null | undefined;
  compositionBullets?: string[];
  homeLatitude?: number | null;
  homeLocationName?: string | null;
}

export function sWindowSection(input: WindowSectionInput): string {
  const {
    dontBother,
    todayBestScore,
    aiText,
    windows,
    dailySummary,
    altLocations,
    runTime,
    peakKpTonight,
    compositionBullets,
    homeLatitude,
    homeLocationName,
  } = input;

  const hasLocalWindow = (windows?.length || 0) > 0;
  const effectiveDontBother = dontBother || !hasLocalWindow;
  const displayPlan = buildWindowDisplayPlan(windows, runTime.nowMinutes);

  if (effectiveDontBother) {
    const headline = hasLocalWindow ? 'Not worth shooting locally' : 'No clear local window';
    const fallbackWindow = windows?.[0];
    const peakHour = fallbackWindow
      ? peakHourForWindow(fallbackWindow) || fallbackWindow.end || fallbackWindow.start
      : null;
    const fallbackLine = fallbackWindow
      ? `If you still go: ${fallbackWindow.label.toLowerCase()} around ${peakHour || 'time TBD'} at ${fallbackWindow.peak}/100.`
      : 'If you still go: no clear local fallback window.';
    return sCard(`
      <div class="card-overline" style="color:${C.error};">Today&apos;s call</div>
      <div class="card-headline">${headline}</div>
      <div style="margin-top:10px;">${sScorePill(todayBestScore)}</div>
      <p class="card-body" style="margin-top:10px;">${esc(fallbackLine)}</p>
    `, { accentSide: 'top', accentColor: C.error });
  }

  const fallbackAiText = timeAwareBriefingFallback(displayPlan);
  const renderedAi = fallbackAiText
    ? { text: fallbackAiText }
    : renderAiBriefingText(aiText, { dontBother, windows, dailySummary, altLocations, peakKpTonight, homeLatitude, homeLocationName });
  const trimmedAiText = renderedAi.text || aiText;

  const windowCards: string[] = [];
  if (!displayPlan.allPast && displayPlan.primary) {
    const primaryLabel = displayPlan.promotedFromPast
      ? 'Next window'
      : classifyWindowTiming(displayPlan.primary, runTime.nowMinutes) === 'current'
        ? 'Live now'
        : 'Best window';
    const allDisplayWindows = [displayPlan.primary, ...displayPlan.remaining.filter(w => w !== displayPlan.primary)];
    windowCards.push(sWindowCard({ window: displayPlan.primary, index: 0, allWindows: allDisplayWindows, sectionLabel: primaryLabel, peakKpTonight, homeLatitude }));
    displayPlan.remaining
      .filter(w => w !== displayPlan.primary)
      .forEach((w, i) => windowCards.push(sWindowCard({ window: w, index: i + 1, allWindows: displayPlan.remaining, sectionLabel: 'Later today', peakKpTonight, homeLatitude })));
  }
  displayPlan.past.forEach((w, i) => windowCards.push(sWindowCard({ window: w, index: i + 1, allWindows: displayPlan.past, sectionLabel: 'Earlier today', peakKpTonight, homeLatitude })));

  const aiCard = sCard(`
    <div class="ai-overline">AI briefing</div>
    ${sHtmlText(trimmedAiText)}
  `);

  const compCard = !fallbackAiText && compositionBullets?.length
    ? sCard(`
        <div class="card-overline">Shot ideas</div>
        <ul class="bullet-list" style="margin-top:4px;">
          ${compositionBullets.map(b => `<li>${esc(b)}</li>`).join('')}
        </ul>
      `, { accentSide: 'left', accentColor: C.secondary })
    : '';

  return `<div class="section-stack">${[...windowCards, aiCard, compCard].filter(Boolean).join('')}</div>`;
}

export function buildWindowSection(
  effectiveDontBother: boolean,
  todayBestScore: number,
  aiText: string,
  windows: Window[] | undefined,
  dailySummary: DaySummary[],
  altLocations: AltLocation[] | undefined,
  runTime: RunTimeContext,
  peakKpTonight: number | null | undefined,
  compositionBullets: string[] | undefined,
  homeLatitude: number | null | undefined,
  homeLocationName: string | null | undefined,
): string {
  const sectionContent = sWindowSection({
    dontBother: effectiveDontBother,
    todayBestScore,
    aiText,
    windows,
    dailySummary,
    altLocations,
    runTime,
    peakKpTonight,
    compositionBullets,
    homeLatitude,
    homeLocationName,
  });

  if (effectiveDontBother) {
    return sectionContent;
  }

  return `<div class="section-group">
    ${sSection("Today's window")}
    ${sectionContent}
  </div>`;
}
