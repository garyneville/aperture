import { esc } from '../../../lib/utils.js';
import {
  C,
  FONT,
  card,
  metricChip,
  scorePill,
  scoreState,
} from '../shared.js';
import {
  sessionConfidenceLabel,
  sessionRecommendationBody,
  sessionRecommendationHeadline,
  sessionRunnerUpLine,
  sessionVolatilityLabel,
  planBScenario,
} from '../../shared/window-helpers.js';
import type { FormatEmailInput } from '../types.js';

export function sessionRecommendationCard(sessionRecommendation: FormatEmailInput['sessionRecommendation']): string {
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

  return card(`
    <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Best session today</div>
    <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:600;line-height:1.24;letter-spacing:-0.01em;color:${C.ink};">${esc(sessionRecommendationHeadline(primary))}</div>
    <div style="Margin-top:10px;">
      ${scorePill(primary.score)}
      ${metricChip('Confidence', sessionConfidenceLabel(primary.confidence), confidenceTone)}
      ${volatility ? metricChip(primary.session === 'storm' ? 'Volatility' : 'Models', volatility, C.tertiary) : ''}
    </div>
    <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(sessionRecommendationBody(primary))}</div>
    ${runnerUp ? `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.subtle};">${esc(runnerUp)}</div>` : ''}
    ${planB ? `<div style="Margin-top:10px;padding:8px 10px;background:${C.surfaceAlt || '#f7f5f0'};border-radius:6px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};"><strong>Plan\u00a0B:</strong> ${esc(planB)}</div>` : ''}
  `, '', `border-left:3px solid ${scoreState(primary.score).fg};`);
}
