import { esc } from '../../../lib/utils.js';
import {
  sessionConfidenceLabel,
  sessionRecommendationBody,
  sessionRecommendationHeadline,
  sessionRunnerUpLine,
  sessionVolatilityLabel,
  planBScenario,
} from '../../shared/window-helpers.js';
import { formatAlerts } from '../../shared/alert-helpers.js';
import type { BriefRenderInput } from '../../../contracts/index.js';
import { C } from '../../shared/brief-primitives.js';
import { sCard, sChip, sScorePill } from './shared.js';
import { scoreState } from '../../shared/brief-primitives.js';

export interface SessionRecInput {
  sessionRecommendation: BriefRenderInput['sessionRecommendation'];
}

function sAlertBadges(sessionRecommendation: SessionRecInput['sessionRecommendation']): string {
  const alerts = formatAlerts(sessionRecommendation?.alerts);
  if (!alerts.length) return '';
  return `<div class="alert-badges" style="margin-bottom:8px;">${alerts.map(a => {
    const cls = a.level === 'warn' ? 'alert-badge-warn' : 'alert-badge-info';
    return `<span class="${cls}" style="display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:6px;font-size:0.8em;font-weight:600;">${esc(a.badge)}</span>`;
  }).join('')}</div>`;
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
  const planB = planBScenario(sessionRecommendation);

  return sCard(`
    <div class="card-overline">Best session today</div>
    <div class="card-headline">${esc(sessionRecommendationHeadline(primary))}</div>
    ${sAlertBadges(sessionRecommendation)}
    <div class="chip-row" style="margin-top:10px;">
      ${sScorePill(primary.score)}
      ${sChip('Confidence', sessionConfidenceLabel(primary.confidence), confidenceTone)}
      ${volatility ? sChip(primary.session === 'storm' ? 'Volatility' : 'Models', volatility, C.tertiary) : ''}
    </div>
    <p class="card-body" style="margin-top:10px;">${esc(sessionRecommendationBody(primary))}</p>
    ${runnerUp ? `<p class="card-body" style="margin-top:8px;color:${C.subtle};">${esc(runnerUp)}</p>` : ''}
    ${planB ? `<div class="plan-b-callout" style="margin-top:10px;padding:8px 10px;background:${C.surfaceAlt || '#f7f5f0'};border-radius:6px;font-size:0.85em;color:${C.muted};"><strong>Plan\u00a0B:</strong> ${esc(planB)}</div>` : ''}
  `, { accentSide: 'left', accentColor: scoreState(primary.score).fg });
}
