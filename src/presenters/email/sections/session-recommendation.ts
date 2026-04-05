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
import { formatAlerts } from '../../shared/alert-helpers.js';
import type { FormatEmailInput } from '../types.js';

function alertChipsHtml(sessionRecommendation: FormatEmailInput['sessionRecommendation']): string {
  const alerts = formatAlerts(sessionRecommendation?.alerts);
  if (!alerts.length) return '';
  return `<div style="Margin-bottom:8px;">${alerts.map(a => {
    const bg = a.level === 'warn' ? C.warningContainer : C.surfaceVariant;
    const fg = a.level === 'warn' ? C.warning : C.muted;
    const border = a.level === 'warn' ? C.warning : C.outline;
    return `<span style="display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:6px;background:${bg};border:1px solid ${border};font-family:${FONT};font-size:11px;line-height:1.3;color:${fg};font-weight:600;">${esc(a.badge)}</span>`;
  }).join('')}</div>`;
}

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
    ${alertChipsHtml(sessionRecommendation)}
    <div style="Margin-top:10px;">
      ${scorePill(primary.score)}
      ${metricChip('Confidence', sessionConfidenceLabel(primary.confidence), confidenceTone)}
      ${volatility ? metricChip(primary.session === 'storm' ? 'Volatility' : 'Models', volatility, C.tertiary) : ''}
    </div>
    <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(sessionRecommendationBody(primary))}</div>
    ${runnerUp ? `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.subtle};">${esc(runnerUp)}</div>` : ''}
    ${planB ? `<div style="Margin-top:10px;padding:8px 10px;background:${C.surfaceVariant};border-radius:6px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};"><strong>Plan\u00a0B:</strong> ${esc(planB)}</div>` : ''}
  `, '', `border-left:3px solid ${scoreState(primary.score).fg};`);
}
