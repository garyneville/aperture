import { esc } from '../../../lib/utils.js';
import {
  sessionConfidenceLabel,
  sessionRecommendationBody,
  sessionRecommendationHeadline,
  sessionRunnerUpLine,
  sessionVolatilityLabel,
} from '../../shared/window-helpers.js';
import type { BriefRenderInput } from '../../../contracts/index.js';
import { C } from '../../shared/brief-primitives.js';
import { sCard, sChip, sScorePill } from './shared.js';
import { scoreState } from '../../shared/brief-primitives.js';

export interface SessionRecInput {
  sessionRecommendation: BriefRenderInput['sessionRecommendation'];
}

export function sSessionRecommendationCard(input: SessionRecInput): string {
  const { sessionRecommendation } = input;
  const primary = sessionRecommendation?.primary;
  if (!primary) return '';

  const confidenceTone = primary.confidence === 'high'
    ? C.success
    : primary.confidence === 'medium'
      ? C.primary
      : C.warning;
  const volatility = sessionVolatilityLabel(primary);
  const runnerUp = sessionRunnerUpLine(sessionRecommendation);

  return sCard(`
    <div class="card-overline">Best session today</div>
    <div class="card-headline">${esc(sessionRecommendationHeadline(primary))}</div>
    <div class="chip-row" style="margin-top:10px;">
      ${sScorePill(primary.score)}
      ${sChip('Confidence', sessionConfidenceLabel(primary.confidence), confidenceTone)}
      ${volatility ? sChip(primary.session === 'storm' ? 'Volatility' : 'Models', volatility, C.tertiary) : ''}
    </div>
    <p class="card-body" style="margin-top:10px;">${esc(sessionRecommendationBody(primary))}</p>
    ${runnerUp ? `<p class="card-body" style="margin-top:8px;color:${C.subtle};">${esc(runnerUp)}</p>` : ''}
  `, { accentSide: 'left', accentColor: scoreState(primary.score).fg });
}
