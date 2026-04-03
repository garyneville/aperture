/**
 * Fallback text generation for time-aware editorial.
 *
 * These functions generate fallback text when AI editorial is unavailable
 * or needs supplementation based on window timing.
 */

import type { WindowDisplayPlan } from '../../types/brief.js';
import { windowRange } from './policy.js';

/**
 * Generate time-aware fallback text based on window display plan.
 *
 * Returns text explaining:
 * - When the primary window was promoted from past windows
 * - When all windows have passed
 * - null when standard AI text should be used
 */
export function timeAwareBriefingFallback(plan: WindowDisplayPlan): string | null {
  const earlier = plan.past[0] || null;

  if (plan.promotedFromPast && earlier && plan.primary) {
    return `${earlier.label} ${windowRange(earlier)} was earlier today. ${plan.primary.label} ${windowRange(plan.primary)} is the best remaining local option.`;
  }

  if (plan.allPast && earlier) {
    return `${earlier.label} ${windowRange(earlier)} was the strongest local window earlier today. No local photo window remains today.`;
  }

  return null;
}
