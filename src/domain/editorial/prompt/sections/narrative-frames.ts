/**
 * Narrative frame selection — deterministically picks a structural
 * angle for the editorial based on the day's dominant forecast signal.
 *
 * Instead of letting the LLM vary adjectives ("stunning", "spectacular"),
 * we rotate the *structural frame* so the briefing reads differently
 * each day even when conditions are similar.
 *
 * @see https://github.com/garyneville/aperture/issues/226
 */

import type { Window, DailySummary } from '../../../windowing/best-windows.js';
import type { AltLocationResult } from '../build-prompt.js';

export type NarrativeFrameId =
  | 'plan-a-plan-b'
  | 'risk-first'
  | 'opportunity-first'
  | 'timing-critical';

export interface NarrativeFrame {
  id: NarrativeFrameId;
  label: string;
  instruction: string;
}

const FRAMES: Record<NarrativeFrameId, Omit<NarrativeFrame, 'id'>> = {
  'plan-a-plan-b': {
    label: 'Plan A / Plan B',
    instruction:
      'Structure the editorial as a primary plan with a pivot: lead with the strongest window, then hint at an alternative angle or session if conditions shift.',
  },
  'risk-first': {
    label: 'Risk-first',
    instruction:
      'Lead with the forecast uncertainty or risk, then explain what makes the reward worthwhile if it plays out. Frame the window as a calculated bet.',
  },
  'opportunity-first': {
    label: 'Opportunity-first',
    instruction:
      'Lead with the standout opportunity — a rare condition, post-frontal clarity, aurora signal, or unusually high score. Frame the window as a moment not to miss.',
  },
  'timing-critical': {
    label: 'Timing-critical',
    instruction:
      'Emphasise the narrow timing: when the window opens, when it closes, and why punctuality matters. Frame the session around the clock.',
  },
};

export interface FrameSelectionInput {
  bestWindow: Window;
  todayDay: DailySummary | undefined;
  altLocations?: AltLocationResult[];
  auroraVisibleLocally: boolean;
  peakKpTonight: number | null;
}

/**
 * Select the most appropriate narrative frame based on today's data.
 *
 * Priority order (first match wins):
 * 1. Timing-critical — window span ≤ 2 hours OR strong trend
 * 2. Risk-first — low/medium confidence with high stdDev
 * 3. Opportunity-first — rare condition (aurora, exceptional score, crepuscular)
 * 4. Plan A / Plan B — viable alternatives exist
 * 5. Opportunity-first — default fallback
 */
export function selectNarrativeFrame(input: FrameSelectionInput): NarrativeFrame {
  const { bestWindow, todayDay, altLocations, auroraVisibleLocally } = input;

  // ── Timing-critical: narrow window or strong trend ────────────
  const windowDurationHours = getWindowDurationHours(bestWindow);
  if (windowDurationHours !== null && windowDurationHours <= 2) {
    return withId('timing-critical');
  }
  if (hasStrongTrend(bestWindow)) {
    return withId('timing-critical');
  }

  // ── Risk-first: uncertain forecast ────────────────────────────
  if (todayDay && isUncertainForecast(todayDay)) {
    return withId('risk-first');
  }

  // ── Opportunity-first: rare / standout condition ──────────────
  if (auroraVisibleLocally) {
    return withId('opportunity-first');
  }
  if (bestWindow.peak >= 75) {
    return withId('opportunity-first');
  }
  if (todayDay && todayDay.crepRayPeak > 50) {
    return withId('opportunity-first');
  }

  // ── Plan A / Plan B: viable alternatives ──────────────────────
  if (altLocations && altLocations.length > 0 && altLocations[0].bestScore >= 40) {
    return withId('plan-a-plan-b');
  }

  // ── Default: opportunity-first ────────────────────────────────
  return withId('opportunity-first');
}

function withId(id: NarrativeFrameId): NarrativeFrame {
  return { id, ...FRAMES[id] };
}

function getWindowDurationHours(w: Window): number | null {
  const startMins = clockToMins(w.start);
  const endMins = clockToMins(w.end);
  if (startMins === null || endMins === null) return null;
  const diff = endMins >= startMins
    ? endMins - startMins
    : (24 * 60 - startMins) + endMins; // crosses midnight
  return diff / 60;
}

function clockToMins(t: string | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

function hasStrongTrend(w: Window): boolean {
  if (!w.hours || w.hours.length < 2) return false;
  const first = w.hours[0].score;
  const last = w.hours[w.hours.length - 1].score;
  return Math.abs(last - first) >= 15;
}

function isUncertainForecast(day: DailySummary): boolean {
  const conf = day.confidence;
  const spread = day.confidenceStdDev;
  if (conf === 'low') return true;
  if (conf === 'medium' && spread !== null && spread >= 12) return true;
  return false;
}
