/**
 * Window scheduling and display policy.
 *
 * These pure functions determine which windows to display based on current time,
 * how to classify windows (past/current/future), and runtime context.
 *
 * This module is the single source of truth for window display policy used by
 * both domain logic (editorial resolution, validation) and presenters.
 */

import type { DebugContext } from '../../lib/debug-context.js';
import { DEFAULT_HOME_LOCATION } from '../../types/home-location.js';
import type { RunTimeContext, Window, WindowDisplayPlan } from '../../types/brief.js';
import { clockToMinutes } from './time.js';

/**
 * Format a window's time range as a display string.
 * Returns single time if start equals end, otherwise returns range.
 */
export function windowRange(window: { start: string; end: string }): string {
  return window.start === window.end ? window.start : `${window.start}-${window.end}`;
}

/**
 * Classify a window relative to the current time.
 * Handles windows that cross midnight correctly.
 */
export function classifyWindowTiming(window: Window, nowMinutes: number): 'past' | 'current' | 'future' {
  const startMinutes = clockToMinutes(window.start);
  const endMinutes = clockToMinutes(window.end);
  if (startMinutes === null || endMinutes === null) return 'future';

  // Window crosses midnight
  if (endMinutes < startMinutes) {
    if (nowMinutes >= startMinutes) return 'current';
    if (nowMinutes < endMinutes) return 'current';
    return 'future';
  }

  // Normal window (same day)
  if (endMinutes < nowMinutes) return 'past';
  if (startMinutes <= nowMinutes) return 'current';
  return 'future';
}

/**
 * Build a display plan for windows based on current time.
 *
 * Determines:
 * - Which window is primary (best remaining, or best overall if all past)
 * - Which windows are remaining (not past)
 * - Which windows are past
 * - Whether the primary was promoted from past (all windows passed)
 */
export function buildWindowDisplayPlan(
  windows: Window[] | undefined,
  nowMinutes: number,
): WindowDisplayPlan {
  const allWindows = windows || [];
  if (!allWindows.length) {
    return { primary: null, remaining: [], past: [], promotedFromPast: false, allPast: false };
  }

  const remaining = allWindows
    .filter(window => classifyWindowTiming(window, nowMinutes) !== 'past')
    .sort((a, b) => (clockToMinutes(a.start) ?? 0) - (clockToMinutes(b.start) ?? 0));

  const past = allWindows
    .filter(window => classifyWindowTiming(window, nowMinutes) === 'past')
    .sort((a, b) => (clockToMinutes(a.start) ?? 0) - (clockToMinutes(b.start) ?? 0));

  const primary = remaining[0] || allWindows[0] || null;
  const originalPrimary = allWindows[0] || null;

  return {
    primary,
    remaining,
    past,
    promotedFromPast: Boolean(primary && originalPrimary && primary !== originalPrimary),
    allPast: remaining.length === 0,
  };
}

/**
 * Get runtime context from debug metadata.
 * Returns current time in minutes, formatted label, and timezone.
 */
export function getRunTimeContext(debugContext?: DebugContext): RunTimeContext {
  const metadata = debugContext?.metadata;
  const timezone = metadata?.timezone || DEFAULT_HOME_LOCATION.timezone;
  const now = metadata?.generatedAt ? new Date(metadata.generatedAt) : null;

  if (!now) {
    return { nowMinutes: 0, nowLabel: '00:00', timezone };
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const hour = Number(parts.find(part => part.type === 'hour')?.value || '0');
  const minute = Number(parts.find(part => part.type === 'minute')?.value || '0');

  return {
    nowMinutes: (hour * 60) + minute,
    nowLabel: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    timezone,
  };
}
