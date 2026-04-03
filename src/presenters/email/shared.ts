import { esc } from '../../core/utils.js';
import {
  renderEmailCard,
  renderEmailHeroCard,
  renderEmailSectionTitle,
} from './email-layout.js';
import { C, FONT, scoreState, type SummaryStat } from '../../renderers/shared/brief-primitives.js';

export {
  BRAND_LOGO,
  C,
  FONT,
  MONO,
  SCORE_THRESHOLDS,
  UTILITY_GLYPHS,
  confidenceDetail,
  dayHeading,
  daylightUtilityLine,
  dewRiskEntry,
  effectiveConf,
  moonIconForPct,
  scoreState,
  weatherIconForHour,
  type SummaryStat,
} from '../../renderers/shared/brief-primitives.js';

export function htmlText(text: string): string {
  const safe = esc(text || '');
  return safe
    .split(/\n{2,}/)
    .map(chunk => `<p style="Margin:0 0 10px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};">${chunk.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function pill(text: string, fg: string, bg: string, border: string): string {
  return `<span class="pill" style="display:inline-block;padding:4px 12px;border-radius:20px;background:${bg};border:1px solid ${border};font-family:${FONT};font-size:12px;font-weight:600;line-height:1.4;color:${fg};">${esc(text)}</span>`;
}

export function metricChip(label: string, value: string | number, tone?: string): string {
  const toneColor = tone || C.primary;
  return `<span class="chip" style="display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:6px;background:${C.surfaceVariant};border:1px solid ${C.outline};font-family:${FONT};font-size:11px;line-height:1.3;color:${C.ink};"><span style="font-weight:600;color:${toneColor};">${esc(label)}</span> ${esc(value)}</span>`;
}

export function metricRun(items: Array<{ label: string; value: string | number; tone?: string }>): string {
  return items
    .map(item => `<span style="display:inline;color:${C.ink};"><span style="font-weight:600;color:${item.tone || C.primary};">${esc(item.label)}</span> ${esc(item.value)}</span>`)
    .join(`<span style="color:${C.subtle};padding:0 2px;"> &middot; </span>`);
}

export function summaryGrid(items: SummaryStat[], columns = 2): string {
  const rows: SummaryStat[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;">
    ${rows.map(row => `
      <tr>
        ${row.map((item, itemIndex) => `
          <td valign="top" style="width:${100 / columns}%;padding:0;${itemIndex > 0 ? 'border-left:1px solid rgba(255,255,255,0.2);' : ''}">
            <div style="padding:10px 12px;">
              <div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:rgba(255,255,255,0.7);">${esc(item.label)}</div>
              <div style="Margin-top:4px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.3;color:#FFFFFF;">${esc(item.value)}</div>
            </div>
          </td>
        `).join('')}
        ${row.length < columns ? `<td style="width:${100 / columns}%;padding:0;border-left:1px solid rgba(255,255,255,0.2);">&nbsp;</td>`.repeat(columns - row.length) : ''}
      </tr>
    `).join('')}
  </table>`;
}

export function spacer(size: number): string {
  return `<tr><td style="height:${size}px;line-height:${size}px;font-size:${size}px;">&nbsp;</td></tr>`;
}

export function card(inner: string, extraClass = '', extraStyle = ''): string {
  const content = extraStyle
    ? `<div style="${extraStyle}">${inner}</div>`
    : inner;
  const rowWrappedContent = `<tr><td style="padding:0;">${content}</td></tr>`;
  return extraClass.includes('hero-card')
    ? renderEmailHeroCard(rowWrappedContent)
    : renderEmailCard(rowWrappedContent);
}

export function sectionTitle(title: string): string {
  return renderEmailSectionTitle(esc(title));
}

export function creativeSpark(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;background:${C.surface};border:1px solid ${C.outline};border-radius:12px;box-shadow:0 1px 3px ${C.shadow};">
    <tr>
      <td style="padding:20px 22px 22px;">
        <div style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.brand};margin-bottom:14px;">✦ Creative spark</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:0.75;color:${C.brand};opacity:0.22;margin-bottom:6px;">&ldquo;</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:${C.ink};font-style:italic;padding:0 4px;">${esc(text)}</div>
      </td>
    </tr>
  </table>`;
}

export function scorePill(score: number, suffix?: string): string {
  const state = scoreState(score);
  const label = `${state.label} - ${score}/100${suffix ? ` ${suffix}` : ''}`;
  return pill(label, state.fg, state.bg, state.border);
}

export function listRows(items: string[]): string {
  return items.filter(Boolean).join('<div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>');
}
