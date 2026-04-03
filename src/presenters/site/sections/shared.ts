import { esc } from '../../../lib/utils.js';
import { C, SCORE_THRESHOLDS, scoreState } from '../../shared/brief-primitives.js';

export function siteScoreClass(score: number): string {
  if (score >= SCORE_THRESHOLDS.excellent) return 'score-excellent';
  if (score >= SCORE_THRESHOLDS.good) return 'score-good';
  if (score >= SCORE_THRESHOLDS.marginal) return 'score-marginal';
  return 'score-poor';
}

export function sPill(text: string, fg: string, bg: string, border: string): string {
  return `<span class="pill" style="color:${fg};background:${bg};border-color:${border};">${esc(text)}</span>`;
}

export function sScorePill(score: number, suffix?: string): string {
  const state = scoreState(score);
  const label = `${state.label} — ${score}/100${suffix ? ` ${suffix}` : ''}`;
  return `<span class="pill ${siteScoreClass(score)}">${esc(label)}</span>`;
}

export function sChip(label: string, value: string | number, tone?: string): string {
  const color = tone || C.primary;
  return `<span class="chip"><span class="chip-label" style="color:${color};">${esc(label)}</span>${value !== '' ? ` ${esc(String(value))}` : ''}</span>`;
}

export function sCard(
  inner: string,
  opts: { accentSide?: 'top' | 'left'; accentColor?: string; extraClass?: string } = {},
): string {
  const { accentSide, accentColor, extraClass = '' } = opts;
  const accentClass = accentSide === 'top' ? ' card--top' : accentSide === 'left' ? ' card--left' : '';
  const accentStyle = accentSide && accentColor ? ` style="border-${accentSide}-color:${accentColor};"` : '';
  return `<div class="card${accentClass}${extraClass ? ` ${extraClass}` : ''}"${accentStyle}>${inner}</div>`;
}

export function sSection(title: string): string {
  return `<h2 class="section-heading">${esc(title)}</h2>`;
}
