import { esc } from '../../../lib/utils.js';
import { sCard } from './shared.js';
import { C } from '../../shared/brief-primitives.js';

export interface KitAdvisoryInput {
  tips: Array<{ text: string }>;
}

export function sKitAdvisoryCard(input: KitAdvisoryInput): string {
  const { tips } = input;
  if (!tips.length) return '';
  return sCard(`
    <div class="card-overline">Kit advisory</div>
    <ul class="kit-list" style="margin-top:4px;">
      ${tips.map(tip => `<li>${esc(tip.text)}</li>`).join('')}
    </ul>
  `, { accentSide: 'left', accentColor: C.tertiary });
}
