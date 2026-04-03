import { esc } from '../../../lib/utils.js';
import { buildOutdoorOutlookModel } from '../../email/outdoor-outlook-model.js';
import { weatherIconForHour } from '../../shared/brief-primitives.js';
import type { DaySummary, Window } from '../../../types/brief.js';
import { sCard } from './shared.js';

export interface HourlyOutlookInput {
  day: DaySummary | undefined;
  title: string;
  caption: string;
  summaryContext: 'today' | 'tomorrow';
  startAtMinutes?: number | null;
  showOvernight?: boolean;
  photoWindows?: Window[];
}

export function sHourlyOutlookSection(input: HourlyOutlookInput): string {
  const { day, title, caption, summaryContext, startAtMinutes, showOvernight, photoWindows } = input;
  const model = buildOutdoorOutlookModel(day, { summaryContext, startAtMinutes, showOvernight, photoWindows });
  if (!model) return '';

  const rows = model.rows.map(({ hour, score, label, reason }) => {
    const rowBg   = label.highlight ? `${label.bg}33` : 'transparent';
    const dot     = label.highlight ? `<span style="color:${label.fg};">&#x25CF;</span>` : `<span style="color:var(--c-outline);">&#x25CB;</span>`;
    return `<tr style="background:${rowBg};">
      <td style="font-size:12px;font-weight:600;">${esc(hour.hour)}</td>
      <td class="col-sky">${weatherIconForHour(hour, 18)}</td>
      <td>${Math.round(hour.tmp)}\u00b0C</td>
      <td>${hour.pp}%</td>
      <td>${hour.wind}km/h</td>
      <td class="col-comfort">${dot}&ensp;${esc(label.text)}</td>
      <td style="color:var(--c-subtle);">
        <div>${score}/100</div>
        ${reason ? `<div style="font-size:10px;opacity:0.8;">${esc(reason)}</div>` : ''}
      </td>
    </tr>`;
  }).join('');

  return sCard(`
    <div class="card-overline">${esc(title)}</div>
    <p class="card-body" style="margin-top:4px;">${esc(model.summaryLine)}</p>
    <div class="hourly-scroll">
      <table class="hourly-table">
        <caption>${esc(caption)}</caption>
        <thead>
          <tr>
            <th>Time</th><th class="col-sky">Sky</th><th>Temp</th>
            <th>Rain</th><th>Wind</th><th>Outdoor</th><th>Score</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);
}
