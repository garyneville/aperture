/**
 * Window helpers - Cross-presenter utilities for window and session display.
 *
 * These functions are used by multiple presenters (email, site) and are not
 * specific to any single output channel. They provide common formatting and
 * logic for displaying photography windows, sessions, and related metadata.
 */

import type { SessionId } from '../../types/session-score.js';
import type { DaySummary, Window, WindowDisplayPlan } from '../../types/brief.js';
import { explainAstroScoreGap } from '../../domain/editorial/astro-score-explanation.js';
import { windowRange } from '../../domain/windowing/index.js';

/**
 * Maps a session ID to its human-readable display name.
 */
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

/**
 * Checks if a window is an astrophotography window.
 */
export function isAstroWindow(window: Window | undefined): boolean {
  if (!window) return false;
  return window.label.toLowerCase().includes('astro') || (window.tops || []).includes('astrophotography');
}

/**
 * Returns a human-readable descriptor for the moon phase based on illumination percentage.
 */
export function moonDescriptor(moonPct: number): string {
  if (moonPct <= 5) return 'New-ish';
  if (moonPct <= 35) return 'Crescent';
  if (moonPct <= 65) return 'Half moon';
  if (moonPct <= 90) return 'Gibbous';
  return 'Full-ish';
}

/**
 * Gets the peak hour for a window, preferring the explicit peakHour field.
 */
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

/**
 * Generates the label for the best time slot.
 */
export function bestTimeLabel(window: Window | null | undefined, promotedFromPast = false): string {
  if (promotedFromPast) return 'Next window';
  if (isAstroWindow(window ?? undefined)) return 'Best astro';
  if (window && !window.fallback) return 'Best light';
  return 'Best time';
}

/**
 * Generates a label for the best day session based on the hour.
 */
export function bestDaySessionLabel(bestDayHour: string | null | undefined): string {
  if (!bestDayHour) return 'Golden hour';
  const hour = Number.parseInt(bestDayHour.slice(0, 2), 10);
  if (!Number.isFinite(hour)) return 'Golden hour';
  return hour < 12 ? 'Morning golden hour' : 'Evening golden hour';
}

/**
 * Normalizes a tag string for display.
 */
export function displayTag(tag: string): string {
  const normalized = tag.trim().toLowerCase();
  const tagMap: Record<string, string> = {
    astrophotography: 'astro',
    'clear light path': 'clear horizon',
    'misty / atmospheric': 'atmospheric',
  };
  return tagMap[normalized] || tag.trim();
}

/**
 * Formats the best tags for display.
 */
export function displayBestTags(bestTags: string | undefined, fallback = 'mixed conditions'): string {
  if (!bestTags) return fallback;
  const visibleTags = bestTags
    .split(',')
    .map(tag => tag.trim())
    .map(tag => displayTag(tag))
    .filter(tag => tag && tag !== 'general' && tag !== 'poor');
  return visibleTags.join(', ') || fallback;
}

/**
 * Builds the summary lines for a local window display.
 */
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

/**
 * Generates a time-aware local summary, handling past/present/future windows.
 */
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
