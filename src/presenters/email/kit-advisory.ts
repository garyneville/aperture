/**
 * Kit advisory - Email-specific rendering for kit recommendations.
 *
 * The core kit recommendation logic has been moved to ../shared/kit-advisory.ts
 * for cross-presenter use. This module re-exports those functions for backwards
 * compatibility and provides email-specific rendering (kitAdvisoryCard).
 */

import { esc } from '../../lib/utils.js';
import { C, FONT, card } from './shared.js';

// Re-export shared kit advisory functions for backwards compatibility
export {
  buildKitTips,
  evaluateKitRules,
  type KitTip,
} from '../shared/kit-advisory.js';

// Import from shared for internal use
import { type KitTip } from '../shared/kit-advisory.js';

/**
 * Renders a kit advisory card for email output.
 */
export function kitAdvisoryCard(tips: KitTip[]): string {
  if (!tips.length) return '';
  const items = tips.map(tip =>
    `<div style="Margin-bottom:6px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.ink};">&#x2022; ${esc(tip.text)}</div>`
  ).join('');
  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Kit advisory</div>
    <div style="Margin-top:4px;">${items}</div>
  `, '', `border-left:3px solid ${C.tertiary};`);
}
