/**
 * Window card rendering for email presentations.
 *
 * This module contains email-specific card rendering functions for photography
 * windows, including the main window card display and composition suggestions.
 */

import { auroraVisibleKpThresholdForLat, isAuroraLikelyVisibleAtLat } from '../../domain/editorial/aurora-visibility.js';
import { esc } from '../../lib/utils.js';
import { resolveHomeLatitude } from '../../types/home-location.js';
import {
  bestTimeLabel,
  displayTag,
  isAstroWindow,
  peakHourForWindow,
} from '../shared/window-helpers.js';
import { C, FONT } from './shared.js';
import { card, metricChip, metricRun, scorePill, dewRiskEntry } from './shared.js';
import type { Window, WindowHour } from '../../contracts/index.js';
import { windowRange } from '../../domain/windowing/index.js';

/**
 * Render a single window card for email display.
 */
export function windowCard(
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

  if (window.fallback) {
    notes.push('Most promising narrow stretch rather than a clean standout window.');
  }
  if ((hour.crepuscular || 0) > 45) {
    notes.push(`Crepuscular ray potential: ${hour.crepuscular}/100 (light shafts through broken cloud).`);
  }
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

  const headerStyle = `Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};`;
  const headlineStyle = `Margin:0;font-family:${FONT};font-size:18px;font-weight:600;line-height:1.24;letter-spacing:-0.01em;color:${C.ink};`;
  const timeStyle = `Margin:4px 0 0;font-family:${FONT};font-size:14px;line-height:1.4;color:${C.muted};`;
  const borderStyle = index === 0 ? `border-top:3px solid ${window.peak >= 70 ? '#10B981' : window.peak >= 40 ? '#F59E0B' : '#EF4444'};` : '';

  return card(`
    <div style="${headerStyle}">${esc(sectionLabel)}</div>
    <div class="headline" style="${headlineStyle}">${esc(window.label)}</div>
    <div style="${timeStyle}">${esc(windowRange(window))}</div>
    <div style="Margin-top:10px;">${scorePill(window.peak)}</div>
    <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};">${metricLine}</div>
    ${tags}
    ${noteBlock}
  `, '', borderStyle);
}

/**
 * Render a composition suggestions card.
 */
export function compositionCard(bullets: string[]): string {
  if (!bullets.length) return '';

  const items = bullets.map(bullet =>
    `<div style="Margin-bottom:6px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};">&#x2022; ${esc(bullet)}</div>`
  ).join('');

  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Shot ideas</div>
    <div style="Margin-top:4px;">${items}</div>
  `, '', `border-left:3px solid ${C.secondary};`);
}

/**
 * Generate a fallback line for poor day display.
 */
export function poorDayFallbackLine(windows: Window[] | undefined): string {
  const fallbackWindow = windows?.[0];
  if (!fallbackWindow) return 'If you still go: no clear local fallback window.';
  const peakHour = peakHourForWindow(fallbackWindow) || fallbackWindow.end || fallbackWindow.start;
  return `If you still go: ${fallbackWindow.label.toLowerCase()} around ${peakHour || 'time TBD'} at ${fallbackWindow.peak}/100.`;
}
