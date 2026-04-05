import { esc } from '../../../lib/utils.js';
import {
  BRAND_LOGO,
  C,
  FONT,
  type SummaryStat,
  card,
  scoreState,
  summaryGrid,
} from '../shared.js';
import { confidenceDetail, effectiveConf } from '../shared.js';
import {
  bestTimeLabel,
  moonAstroContext,
  moonDescriptor,
} from '../../shared/window-helpers.js';
import type { WindowDisplayPlan } from '../../../contracts/index.js';
import { windowRange } from '../../../domain/windowing/index.js';
import type { DaySummary, Window } from '../types.js';
import { alternativeSummaryTitle, alternativeTimingSummary } from './alternatives.js';
import type { AltLocation, SpurOfTheMomentSuggestion } from '../types.js';

export interface HeroSectionParams {
  heroScore: number;
  today: string;
  locationName: string;
  todayScoreState: ReturnType<typeof scoreState>;
  topWindow: Window | null;
  effectiveDontBother: boolean;
  displayPlan: WindowDisplayPlan;
  todayDay: DaySummary;
  moonPct: number;
  sunriseStr: string;
  sunsetStr: string;
  todayEffConf: string | null | undefined;
  todayEffStdDev: number | null | undefined;
  peakLocalHour: string | null | undefined;
  topWindowIsAstro: boolean;
  topAlternative: AltLocation | null;
  topAlternativeIsCloseContender: boolean;
  localSummary: string;
  spurOfTheMoment?: SpurOfTheMomentSuggestion | null;
  hasAstroWindow?: boolean;
}

export function heroSection(p: HeroSectionParams): string {
  const { confidence: todayConfidence } = effectiveConf(p.todayDay, p.topWindowIsAstro);
  const todayConf = confidenceDetail(todayConfidence);

  const factStats: SummaryStat[] = [
    { label: 'Sunrise', value: p.sunriseStr, tone: C.primary },
    { label: 'Sunset', value: p.sunsetStr, tone: C.primary },
    { label: 'Moon', value: `${moonDescriptor(p.moonPct)} · ${p.moonPct}% lit`, tone: C.tertiary },
  ];

  if (todayConf) {
    factStats.push({
      label: 'Certainty',
      value: p.todayEffStdDev !== null && p.todayEffStdDev !== undefined
        ? `${todayConf.label} · spread ${p.todayEffStdDev} pts`
        : todayConf.label,
      tone: todayConf.fg,
    });
  }

  const scoreStats: SummaryStat[] = [
    { label: 'AM light', value: `${p.todayDay.amScore ?? 0}/100`, tone: scoreState(p.todayDay.amScore ?? 0).fg },
    { label: 'PM light', value: `${p.todayDay.pmScore ?? 0}/100`, tone: scoreState(p.todayDay.pmScore ?? 0).fg },
    { label: 'Peak astro', value: `${p.todayDay.astroScore ?? 0}/100`, tone: scoreState(p.todayDay.astroScore ?? 0).fg },
    { label: bestTimeLabel(p.topWindow, p.displayPlan.promotedFromPast), value: p.peakLocalHour || 'No clear slot', tone: C.onPrimaryContainer },
  ];

  const spurMatchesTopAlt = !!p.spurOfTheMoment && !!p.topAlternative && p.spurOfTheMoment.locationName === p.topAlternative.name;
  const altSpurHook = spurMatchesTopAlt ? `\n"${p.spurOfTheMoment!.hookLine}"` : '';
  const altTimingNote = alternativeTimingSummary(p.topAlternative);
  const alternativeSummary = p.topAlternative
    ? `${p.topAlternative.name} · ${p.topAlternative.bestScore}/100 · ${p.topAlternative.driveMins} min drive${altTimingNote}${altSpurHook}`
    : '';

  const heroWindowLabel = p.topWindow
    ? `${p.displayPlan.allPast ? '<span style="font-weight:400;color:rgba(255,255,255,0.40);">Earlier today:</span><br>' : ''}${esc(p.topWindow.label)}<br><span style="font-weight:400;color:rgba(255,255,255,0.45);font-size:12px;">${esc(windowRange(p.topWindow))}</span>`
    : p.effectiveDontBother
      ? '<span style="font-weight:400;color:rgba(255,255,255,0.40);">No clear window today</span>'
      : '';

  return card(`
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td valign="middle">
        <span style="color:${C.brand};margin-right:8px;vertical-align:middle;">${BRAND_LOGO}</span><span style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;vertical-align:middle;">Aperture</span>
      </td>
      <td align="right" valign="middle">
        <span style="font-family:${FONT};font-size:12px;font-weight:400;color:rgba(255,255,255,0.38);">${esc(p.locationName)}</span>
      </td>
    </tr>
  </table>
  <div style="height:1px;background:rgba(255,255,255,0.10);margin:14px 0 16px;"></div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="38%" valign="top">
        <div class="hero-score" style="font-family:${FONT};font-size:64px;font-weight:700;line-height:1;letter-spacing:-0.04em;color:${C.brand};">${p.heroScore}</div>
        <div style="font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-top:4px;">/ 100</div>
      </td>
      <td valign="top" style="padding-left:16px;border-left:1px solid rgba(255,255,255,0.10);">
        <div class="hero-title" style="font-family:${FONT};font-size:17px;font-weight:700;line-height:1.2;letter-spacing:0.02em;text-transform:uppercase;color:#FFFFFF;">${esc(p.todayScoreState.label)}</div>
        ${heroWindowLabel ? `<div style="font-family:${FONT};font-size:13px;font-weight:600;line-height:1.5;color:rgba(255,255,255,0.70);margin-top:8px;">${heroWindowLabel}</div>` : ''}
        <div style="font-family:${FONT};font-size:11px;color:rgba(255,255,255,0.38);margin-top:10px;">${esc(p.today)}</div>
      </td>
    </tr>
  </table>
  <div style="height:1px;background:rgba(255,255,255,0.10);margin:16px 0;"></div>
  <div style="border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.10);overflow:hidden;">${summaryGrid(factStats, 2)}</div>
  <div style="Margin-top:5px;padding:0 2px;font-family:${FONT};font-size:11px;color:rgba(255,255,255,0.36);">${moonAstroContext(p.moonPct, p.hasAstroWindow)}</div>
  <div style="Margin-top:8px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.10);overflow:hidden;">${summaryGrid(scoreStats, 2)}</div>
  ${p.localSummary || alternativeSummary ? '<div style="height:1px;background:rgba(255,255,255,0.10);margin:14px 0 10px;"></div>' : ''}
  ${p.localSummary ? `<div style="font-family:${FONT};font-size:12px;line-height:1.55;color:rgba(255,255,255,0.60);">${esc(p.localSummary.replace(/\n/g, ' · '))}</div>` : ''}
  ${alternativeSummary ? `<div style="font-family:${FONT};font-size:11px;line-height:1.5;color:rgba(255,255,255,0.38);margin-top:5px;">${esc(alternativeSummaryTitle(p.topAlternative, p.topAlternativeIsCloseContender))}: ${esc(alternativeSummary)}</div>` : ''}
  `, 'hero-card', `background:linear-gradient(160deg, ${C.heroGradientStart} 0%, ${C.heroGradientEnd} 100%);border-color:rgba(255,255,255,0.08);`);
}
