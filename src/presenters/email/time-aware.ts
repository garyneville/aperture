import { explainAstroScoreGap } from '../../lib/astro-score-explanation.js';
import { renderAiBriefingText } from '../../lib/ai-briefing.js';
import { auroraVisibleKpThresholdForLat, isAuroraLikelyVisibleAtLat } from '../../lib/aurora-visibility.js';
import { esc } from '../../lib/utils.js';
import type {
  SessionConfidence,
  SessionId,
  SessionRecommendation,
  SessionRecommendationSummary,
} from '../../types/session-score.js';
import {
  C,
  FONT,
  card,
  dewRiskEntry,
  htmlText,
  listRows,
  metricChip,
  metricRun,
  moonIconForPct,
  scorePill,
  scoreState,
} from './shared.js';
import type {
  AltLocation,
  DaySummary,
  RunTimeContext,
  Window,
  WindowDisplayPlan,
  WindowHour,
} from './types.js';
import { resolveHomeLatitude } from '../../types/home-location.js';
import {
  buildWindowDisplayPlan,
  classifyWindowTiming,
  clockToMinutes,
  getRunTimeContext,
  minutesToClock,
  timeAwareBriefingFallback,
  windowRange,
} from '../../domain/windowing/index.js';

export function moonDescriptor(moonPct: number): string {
  if (moonPct <= 5) return 'New-ish';
  if (moonPct <= 35) return 'Crescent';
  if (moonPct <= 65) return 'Half moon';
  if (moonPct <= 90) return 'Gibbous';
  return 'Full-ish';
}

export function moonAstroContext(moonPct: number): string {
  const icon = moonIconForPct(moonPct);
  if (moonPct <= 15) return `${icon} Dark skies — excellent for astrophotography`;
  if (moonPct <= 40) return `${icon} Low moon glow — good for astrophotography`;
  if (moonPct <= 70) return `${icon} Moderate moon — astrophotography compromised`;
  if (moonPct <= 90) return `${icon} Bright moon — poor for astrophotography`;
  return `${icon} Full moon — avoid astrophotography`;
}

export function isAstroWindow(window: Window | undefined): boolean {
  if (!window) return false;
  return window.label.toLowerCase().includes('astro') || (window.tops || []).includes('astrophotography');
}

export function peakHourForWindow(window: Window | undefined): string | null {
  if (!window?.hours?.length) return null;
  // Prefer the explicit peakHour field populated by the scoring pipeline.
  // Falling back to score-matching is unreliable: window.peak holds the session
  // score (e.g. 100 for long-exposure) while hour.score holds the daily final
  // score (e.g. 14), so the equality check never fires and we'd silently take
  // the last hour in the array instead of the actual peak hour.
  if (window.peakHour) return window.peakHour;
  const peakHour = window.hours.find(hour => hour.score === window.peak) || window.hours[window.hours.length - 1];
  return peakHour?.hour || null;
}

// Re-export windowing functions for backwards compatibility.
// These are implemented in src/domain/windowing/ and re-exported here
// so existing presenter imports continue to work.
export {
  buildWindowDisplayPlan,
  classifyWindowTiming,
  clockToMinutes,
  getRunTimeContext,
  minutesToClock,
  timeAwareBriefingFallback,
  windowRange,
} from '../../domain/windowing/index.js';

export function timeAwareLocalSummary(
  plan: WindowDisplayPlan,
  primary: Window | null,
  lines: string[],
): string {
  const referencesWindow = (line: string, window: Window | null): boolean => {
    if (!line || !window) return false;
    const lower = line.toLowerCase();
    return lower.includes(window.label.toLowerCase()) && lower.includes(windowRange(window).toLowerCase());
  };
  const dedupedLines = lines.filter(line => {
    if (!line) return false;
    if (plan.promotedFromPast && referencesWindow(line, primary)) return false;
    if (plan.promotedFromPast && referencesWindow(line, plan.past[0] || null)) return false;
    return true;
  });

  if (plan.promotedFromPast && primary && plan.past[0]) {
    const earlier = plan.past[0];
    return [
      `${earlier.label}: ${windowRange(earlier)} at ${earlier.peak}/100 earlier today.`,
      `${primary.label}: ${windowRange(primary)} at ${primary.peak}/100 is the best remaining local option.`,
      ...dedupedLines,
    ].filter(Boolean).join('\n');
  }
  if (plan.allPast && plan.past[0]) {
    const earlier = plan.past[0];
    return `${earlier.label}: ${windowRange(earlier)} at ${earlier.peak}/100 was the strongest local window earlier today. No local photo window remains today.`;
  }
  return dedupedLines.join('\n');
}

export function displayTag(tag: string): string {
  const normalized = tag.trim().toLowerCase();
  const tagMap: Record<string, string> = {
    astrophotography: 'astro',
    'clear light path': 'clear horizon',
    'misty / atmospheric': 'atmospheric',
  };
  return tagMap[normalized] || tag.trim();
}

export function bestTimeLabel(window: Window | null | undefined, promotedFromPast = false): string {
  if (promotedFromPast) return 'Next window';
  if (isAstroWindow(window ?? undefined)) return 'Best astro';
  if (window && !window.fallback) return 'Best light';
  return 'Best time';
}

export function displayBestTags(bestTags: string | undefined, fallback = 'mixed conditions'): string {
  if (!bestTags) return fallback;
  const visibleTags = bestTags
    .split(',')
    .map(tag => tag.trim())
    .map(tag => displayTag(tag))
    .filter(tag => tag && tag !== 'general' && tag !== 'poor');
  return visibleTags.join(', ') || fallback;
}

export function displaySessionName(session: SessionId): string {
  switch (session) {
    case 'golden-hour':
      return 'Golden hour';
    case 'astro':
      return 'Astro';
    case 'mist':
      return 'Mist';
    case 'storm':
      return 'Storm';
    case 'urban':
      return 'Urban';
    case 'long-exposure':
      return 'Long exposure';
    case 'street':
      return 'Street';
    case 'wildlife':
      return 'Wildlife';
    case 'waterfall':
      return 'Waterfall';
    case 'seascape':
      return 'Seascape';
  }
}

export function sessionConfidenceLabel(confidence: SessionConfidence): string {
  switch (confidence) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Fair confidence';
    case 'low':
      return 'Low confidence';
  }
}

export function sessionVolatilityLabel(primary: SessionRecommendation): string | null {
  if (primary.volatility === null || primary.volatility === undefined) return null;
  if (primary.session === 'storm') {
    return primary.volatility >= 20
      ? `Volatile opportunity · spread ${primary.volatility} pts`
      : `Changeable setup · spread ${primary.volatility} pts`;
  }
  return `Spread ${primary.volatility} pts`;
}

export function sessionRecommendationHeadline(primary: SessionRecommendation): string {
  return `${displaySessionName(primary.session)} at ${primary.hourLabel}`;
}

export function sessionRecommendationBody(primary: SessionRecommendation): string {
  const reasons = primary.reasons.slice(0, 2).join(' ');
  const warning = primary.warnings[0] || '';
  return [reasons, warning].filter(Boolean).join(' ')
    || `${displaySessionName(primary.session)} is the strongest specialist setup in the current forecast.`;
}

export function sessionRunnerUpLine(summary: SessionRecommendationSummary | undefined): string | null {
  const primary = summary?.primary;
  const runnerUp = summary?.runnerUps?.[0];
  if (!primary || !runnerUp) return null;
  if (primary.confidence !== 'low' && (primary.volatility ?? 0) < 20) return null;
  return `Runner-up: ${displaySessionName(runnerUp.session)} at ${runnerUp.hourLabel} (${runnerUp.score}/100).`;
}

export function bestDaySessionLabel(bestDayHour: string | null | undefined): string {
  if (!bestDayHour) return 'Golden hour';
  const hour = Number.parseInt(bestDayHour.slice(0, 2), 10);
  if (!Number.isFinite(hour)) return 'Golden hour';
  return hour < 12 ? 'Morning golden hour' : 'Evening golden hour';
}

export function forecastBestLine(day: DaySummary): string {
  const isAstroLed = (day.astroScore ?? 0) > (day.photoScore ?? 0);
  if (isAstroLed) {
    return `Best local astro around ${day.bestAstroHour || 'nightfall'}`;
  }
  return `Best at ${day.bestPhotoHour || '-'} - ${displayBestTags(day.bestTags)}`;
}

function windowCard(
  window: Window,
  index: number,
  windows: Window[],
  sectionLabel = index === 0 ? 'Best window' : 'Worth watching',
  peakKpTonight?: number | null,
  homeLatitude?: number | null,
): string {
  const hour = window.hours?.find(entry => entry.score === window.peak) || window.hours?.[0] || {} as WindowHour;
  const notes: string[] = [];
  const topWindow = windows[0];
  const resolvedHomeLatitude = resolveHomeLatitude({ homeLatitude });
  if (window.fallback) notes.push('Most promising narrow stretch rather than a clean standout window.');
  if ((hour.crepuscular || 0) > 45) notes.push(`Crepuscular ray potential: ${hour.crepuscular}/100 (light shafts through broken cloud).`);
  if (window.darkPhaseStart && window.postMoonsetScore !== null && window.postMoonsetScore !== undefined) {
    notes.push(`Dark from ${window.darkPhaseStart} - peak after moonset ${window.postMoonsetScore}/100.`);
  }
  if (index === 0 && isAstroWindow(window) && isAuroraLikelyVisibleAtLat(resolvedHomeLatitude, peakKpTonight)) {
    const threshold = auroraVisibleKpThresholdForLat(resolvedHomeLatitude);
    notes.push(`Coincides with an active aurora signal (Kp ${peakKpTonight?.toFixed(1) ?? 'unknown'} vs local threshold Kp ${threshold}) - favour a clean northern horizon.`);
  }
  if (index > 0 && isAstroWindow(topWindow) && isAstroWindow(window) && topWindow?.label !== window.label) {
    notes.push('Later, darker backup if you miss the first astro slot.');
  }

  const metricLine = metricRun([
    { label: 'Cloud high', value: `${hour.ch ?? '-'}%`, tone: C.primary },
    { label: 'Visibility', value: `${hour.visK ?? '-'}km`, tone: C.secondary },
    { label: 'Wind', value: `${hour.wind ?? '-'}km/h`, tone: C.tertiary },
    { label: 'Rain', value: `${hour.pp ?? '-'}%`, tone: C.error },
    ...dewRiskEntry(hour.tpw, hour.tmp),
  ]);
  const tags = (window.tops || []).length
    ? `<div style="Margin-top:10px;">${(window.tops || []).map(tag => metricChip(displayTag(tag), '', C.primary)).join('')}</div>`
    : '';
  const noteBlock = notes.length
    ? `<div style="Margin-top:10px;padding-top:12px;border-top:1px solid ${C.outline};font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(notes.join(' '))}</div>`
    : '';

  return card(`
    <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">${esc(sectionLabel)}</div>
    <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:600;line-height:1.24;letter-spacing:-0.01em;color:${C.ink};">${esc(window.label)}</div>
    <div style="Margin:4px 0 0;font-family:${FONT};font-size:14px;line-height:1.4;color:${C.muted};">${esc(windowRange(window))}</div>
    <div style="Margin-top:10px;">${scorePill(window.peak)}</div>
    <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};">${metricLine}</div>
    ${tags}
    ${noteBlock}
  `, '', index === 0 ? `border-top:3px solid ${scoreState(window.peak).fg};` : '');
}

function compositionCard(bullets: string[]): string {
  if (!bullets.length) return '';
  const items = bullets.map(bullet =>
    `<div style="Margin-bottom:6px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};">&#x2022; ${esc(bullet)}</div>`
  ).join('');
  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Shot ideas</div>
    <div style="Margin-top:4px;">${items}</div>
  `, '', `border-left:3px solid ${C.secondary};`);
}

function poorDayFallbackLine(windows: Window[] | undefined): string {
  const fallbackWindow = windows?.[0];
  if (!fallbackWindow) return 'If you still go: no clear local fallback window.';
  const peakHour = peakHourForWindow(fallbackWindow) || fallbackWindow.end || fallbackWindow.start;
  return `If you still go: ${fallbackWindow.label.toLowerCase()} around ${peakHour || 'time TBD'} at ${fallbackWindow.peak}/100.`;
}

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

export function localSummaryLines(
  plan: WindowDisplayPlan,
  topWindow: Window | null,
  todayDay: DaySummary,
): string[] {
  const astroGap = topWindow
    ? explainAstroScoreGap({ window: topWindow, today: todayDay })
    : null;
  const nextWindow = plan.remaining.find(window => window !== topWindow) || null;

  return [
    topWindow
      ? `${topWindow.label}: ${windowRange(topWindow)} at ${topWindow.peak}/100.`
      : todayDay.bestTags
        ? `Best local setup: ${todayDay.bestPhotoHour || 'time TBD'} for ${displayBestTags(todayDay.bestTags)}.`
        : todayDay.bestPhotoHour
          ? `Best local setup: ${todayDay.bestPhotoHour}.`
          : '',
    astroGap && !plan.promotedFromPast ? astroGap.text : '',
    nextWindow && isAstroWindow(topWindow || undefined) && isAstroWindow(nextWindow)
      ? `${nextWindow.label}: ${nextWindow.start}-${nextWindow.end} at ${nextWindow.peak}/100 if you miss the first slot.`
      : '',
  ];
}
