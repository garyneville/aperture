import { esc } from '../../../lib/utils.js';
import {
  BRAND_LOGO,
  C,
  type SummaryStat,
} from '../../shared/brief-primitives.js';
import { windowRange } from '../../../domain/windowing/index.js';
import { moonAstroContext } from '../../shared/window-helpers.js';
import type { Window } from '../../../contracts/index.js';

function sStatGrid(items: SummaryStat[], variant: 'dark' | 'light' = 'dark'): string {
  const lightClass = variant === 'light' ? ' stat-grid--light' : '';
  const cells = items.map(item => {
    const style = item.tone ? ` style="color:${item.tone};"` : '';
    return `<div class="stat-cell">
      <div class="stat-label">${esc(item.label)}</div>
      <div class="stat-value"${style}>${esc(item.value)}</div>
    </div>`;
  }).join('');
  return `<div class="stat-grid${lightClass}">${cells}</div>`;
}

export interface HeroCardProps {
  heroScore: number;
  gradeLabel: string;
  locationName: string;
  topWindow: Window | null;
  allPast: boolean;
  today: string;
  factStats: SummaryStat[];
  scoreStats: SummaryStat[];
  moonPct: number;
  localSummary: string;
  alternativeSummary: string;
  altSummaryTitle: string;
  hasAstroWindow?: boolean;
}

export function sHeroCard(props: HeroCardProps): string {
  const {
    heroScore,
    gradeLabel,
    locationName,
    topWindow,
    allPast,
    today,
    factStats,
    scoreStats,
    moonPct,
    localSummary,
    alternativeSummary,
    altSummaryTitle,
  } = props;

  let windowHtml = '';
  if (topWindow) {
    const pastLabel = allPast
      ? `<span style="font-weight:400;color:rgba(255,255,255,0.40);">Earlier today:</span><br>`
      : '';
    windowHtml = `<div class="hero-window-label">${pastLabel}${esc(topWindow.label)}<br><span class="hero-window-range">${esc(windowRange(topWindow))}</span></div>`;
  } else {
    windowHtml = `<div class="hero-window-label" style="color:rgba(255,255,255,0.40);">No clear window today</div>`;
  }

  return `<div class="card card--hero">
    <div class="hero-brand">
      <div class="hero-brand-left">
        <span style="color:${C.brand};">${BRAND_LOGO}</span>
        <span class="hero-brand-name">Aperture</span>
      </div>
      <span class="hero-location">${esc(locationName)}</span>
    </div>
    <hr class="hero-divider">
    <div class="hero-score-row">
      <div class="hero-score-block">
        <div class="hero-score-number">${heroScore}</div>
        <div class="hero-score-denom">/ 100</div>
      </div>
      <div class="hero-detail">
        <div class="hero-grade">${esc(gradeLabel)}</div>
        ${windowHtml}
        <div class="hero-date">${esc(today)}</div>
      </div>
    </div>
    <hr class="hero-divider">
    ${sStatGrid(factStats, 'dark')}
    <div class="moon-context">${moonAstroContext(moonPct, props.hasAstroWindow)}</div>
    ${sStatGrid(scoreStats, 'dark')}
    ${localSummary || alternativeSummary ? '<hr class="hero-divider" style="margin:12px 0 8px;">' : ''}
    ${localSummary ? `<div style="font-size:12px;line-height:1.55;color:rgba(255,255,255,0.60);">${esc(localSummary.replace(/\n/g, ' · '))}</div>` : ''}
    ${alternativeSummary ? `<div style="font-size:11px;line-height:1.5;color:rgba(255,255,255,0.38);margin-top:5px;">${esc(altSummaryTitle)}: ${esc(alternativeSummary)}</div>` : ''}
  </div>`;
}
