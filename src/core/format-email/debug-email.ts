import { esc } from '../utils.js';
import type { DebugContext } from '../debug-context.js';
import { C, FONT, MONO, card, spacer } from './shared.js';

function debugCard(title: string, body: string): string {
  return card(
    `<div style="font-family:${FONT};font-size:14px;font-weight:600;line-height:1.3;color:${C.ink};Margin:0 0 10px;">${esc(title)}</div>${body}`,
    '',
    'border-left:3px solid #A8D4FB;',
  );
}

function debugTable(headers: string[], rows: string[][], emptyMessage = 'No data recorded for this run.'): string {
  if (!rows.length) {
    return `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">${esc(emptyMessage)}</div>`;
  }

  return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        ${headers.map(header => `<th scope="col" align="left" style="padding:6px 8px;border-bottom:2px solid ${C.outline};font-family:${FONT};font-size:11px;font-weight:600;line-height:1.3;color:${C.muted};text-transform:uppercase;">${esc(header)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows.map(row => `<tr>${row.map(cell => `<td valign="top" style="padding:7px 8px;border-bottom:1px solid ${C.surfaceVariant};font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">${cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>`;
}

function debugKeyValueLines(items: Array<[string, string | number | null | undefined]>): string {
  return items
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `<div style="font-family:${FONT};font-size:12px;line-height:1.6;color:${C.ink};"><span style="font-weight:600;color:${C.onPrimaryContainer};">${esc(label)}:</span> ${esc(value)}</div>`)
    .join('');
}

function displayDebugConfidence(confidence: string | null | undefined): string | null {
  if (!confidence) return null;
  if (confidence === 'medium') return 'Fair';
  return confidence;
}

function displaySessionName(value: string): string {
  return value
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sessionScoreSummary(hour: DebugContext['hourlyScoring'][number]): string {
  if (!hour.sessionScores?.length) return '—';
  return hour.sessionScores
    .map(score => {
      const confidence = displayDebugConfidence(score.confidence) || score.confidence;
      const gating = score.hardPass ? '' : ' gated';
      return `${esc(displaySessionName(score.session))} ${esc(String(score.score))}/100${esc(gating)} (${esc(confidence)})`;
    })
    .join('<br>');
}

export function formatDebugEmail(debugContext: DebugContext): string {
  const metadata = debugContext.metadata;
  const scores = debugContext.scores;
  const hourlyRows = debugContext.hourlyScoring.map(hour => ([
    esc(hour.hour),
    esc(String(hour.final)),
    esc(`${hour.cloud}%`),
    esc(`${hour.visK}km`),
    esc(String(hour.aod)),
    esc(`${hour.moon.altitudeDeg}° / ${hour.moon.illuminationPct}%`),
    esc(hour.moonState),
    esc(String(hour.moonAdjustment)),
    esc(String(hour.aodPenalty)),
    esc(`${hour.astroScore}`),
    sessionScoreSummary(hour),
  ]));
  const showDarkPhaseColumn = debugContext.windows.some(window => Boolean(window.darkPhaseStart));
  const windowRows = debugContext.windows.map(window => {
    const row = [
      esc(`#${window.rank}`),
      esc(window.label),
      esc(`${window.start}-${window.end}`),
      esc(String(window.peak)),
      esc(window.selected ? 'Yes' : 'No'),
      esc(window.selectionReason),
    ];
    if (showDarkPhaseColumn) {
      row.push(esc(window.darkPhaseStart ? `Dark after ${window.darkPhaseStart}${window.postMoonsetScore !== null && window.postMoonsetScore !== undefined ? ` (${window.postMoonsetScore}/100)` : ''}` : '—'));
    }
    return row;
  });
  const altRows = debugContext.nearbyAlternatives.map(alt => ([
    esc(`#${alt.rank}`),
    esc(alt.name),
    esc(String(alt.bestScore)),
    esc(`${alt.driveMins}m`),
    esc(`B${alt.bortle}`),
    esc(alt.darknessDelta >= 0 ? `+${alt.darknessDelta}` : `${alt.darknessDelta}`),
    esc(alt.weatherDelta >= 0 ? `+${alt.weatherDelta}` : `${alt.weatherDelta}`),
    esc(alt.deltaVsWindowPeak !== null && alt.deltaVsWindowPeak !== undefined
      ? (alt.deltaVsWindowPeak >= 0 ? `+${alt.deltaVsWindowPeak}` : `${alt.deltaVsWindowPeak}`)
      : '—'),
    esc(alt.shown ? 'Shown' : alt.discardedReason || 'Hidden'),
  ]));
  const longRangeRows = (debugContext.longRangeCandidates || []).map(candidate => ([
    esc(`#${candidate.rank}`),
    esc(candidate.name),
    esc(candidate.region),
    esc(String(candidate.bestScore)),
    esc(String(candidate.dayScore)),
    esc(String(candidate.astroScore)),
    esc(candidate.deltaVsHome >= 0 ? `+${candidate.deltaVsHome}` : `${candidate.deltaVsHome}`),
    esc(candidate.darkSky ? 'Yes' : 'No'),
    esc(candidate.shown ? 'Shown' : candidate.discardedReason || 'Eligible pool candidate'),
  ]));
  const kitRows = (debugContext.kitAdvisory?.rules || []).map(rule => ([
    esc(rule.id),
    esc(rule.threshold),
    esc(rule.value),
    rule.matched
      ? `<span style="color:${C.success};font-weight:700;">Yes ✓</span>`
      : `<span style="color:${C.muted};">No</span>`,
    rule.shown
      ? `<span style="color:${C.success};font-weight:700;">Shown</span>`
      : `<span style="color:${C.muted};">Hidden</span>`,
  ]));
  const aiTrace = debugContext.ai;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Photo Brief Debug</title>
</head>
<body style="margin:0;padding:16px;background:${C.page};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td>
        ${debugCard('Run metadata', debugKeyValueLines([
          ['Generated at', metadata?.generatedAt],
          ['Location', metadata?.location],
          ['Lat / lon', metadata ? `${metadata.latitude}, ${metadata.longitude}` : null],
          ['Timezone', metadata?.timezone],
          ['Workflow version', metadata?.workflowVersion || null],
          ['Debug mode', metadata ? `${metadata.debugModeEnabled ? 'enabled' : 'disabled'}${metadata.debugModeSource ? ` (${metadata.debugModeSource})` : ''}` : null],
          ['Debug recipient', metadata?.debugRecipient || null],
        ]))}
        ${spacer(8)}
        ${debugCard('Day scores and certainty', debugKeyValueLines([
          ['AM', scores ? `${scores.am}/100` : null],
          ['PM', scores ? `${scores.pm}/100` : null],
          ['Astro', scores ? `${scores.astro}/100` : null],
          ['Overall', scores ? `${scores.overall}/100` : null],
          ['Best session today', scores?.bestSession ? `${displaySessionName(scores.bestSession.session)} (${scores.bestSession.score}/100 at ${scores.bestSession.hour})` : null],
          ['Best session confidence', scores?.bestSession ? displayDebugConfidence(scores.bestSession.confidence) : null],
          ['Certainty (daylight)', displayDebugConfidence(scores?.certainty)],
          ['Spread (daylight)', scores?.certaintySpread !== null && scores?.certaintySpread !== undefined ? `${scores.certaintySpread} pts` : null],
          ['Certainty (astro)', scores?.astroConfidence && scores.astroConfidence !== 'unknown' ? displayDebugConfidence(scores.astroConfidence) : null],
          ['Spread (astro)', scores?.astroConfidenceStdDev !== null && scores?.astroConfidenceStdDev !== undefined ? `${scores.astroConfidenceStdDev} pts` : null],
        ]))}
        ${spacer(8)}
        ${debugCard('Window selection trace', debugTable(
          showDarkPhaseColumn
            ? ['Rank', 'Window', 'Range', 'Peak', 'Selected', 'Reason', 'Dark phase']
            : ['Rank', 'Window', 'Range', 'Peak', 'Selected', 'Reason'],
          windowRows,
          'No local window cleared threshold for this run.',
        ))}
        ${spacer(8)}
        ${debugCard('Hourly scoring trace', debugTable(
          ['Hour', 'Final', 'Cloud', 'Vis', 'AOD', 'Moon', 'Moon state', 'Moon score', 'AOD pen', 'Astro', 'Sessions'],
          hourlyRows,
        ))}
        ${spacer(8)}
        ${debugCard('Nearby alternatives', debugTable(
          ['Rank', 'Location', 'Score', 'Drive', 'Bortle', 'Dark Δ', 'Δ vs Home', 'Δ vs window', 'Outcome'],
          altRows,
        ))}
        ${spacer(8)}
        ${debugCard('Long-range pool', longRangeRows.length
          ? debugTable(
              ['Rank', 'Location', 'Region', 'Best', 'Day', 'Astro', 'Δ vs Home', 'Dark sky', 'Outcome'],
              longRangeRows,
            )
          : `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">No long-range candidates met the threshold this run.</div>`
        )}
        ${aiTrace ? `${spacer(8)}${debugCard('AI editorial trace', `
          ${debugKeyValueLines([
            ['Primary provider', aiTrace.primaryProvider || null],
            ['Selected provider', aiTrace.selectedProvider || null],
            ['Factual check', aiTrace.factualCheck.passed ? 'Passed' : `Failed (${aiTrace.factualCheck.rulesTriggered.join(', ')})`],
            ['Editorial check', aiTrace.editorialCheck.passed ? 'Passed' : `Failed (${aiTrace.editorialCheck.rulesTriggered.join(', ')})`],
            ['Model fallback', aiTrace.modelFallbackUsed ? `Yes — ${aiTrace.primaryProvider} failed, used ${aiTrace.selectedProvider}` : 'No'],
            ['Hardcoded fallback', aiTrace.fallbackUsed ? 'Yes — both models failed, using template text' : 'No'],
            ['Gemini HTTP status', aiTrace.geminiDiagnostics?.statusCode ?? null],
            ['Gemini finish reason', aiTrace.geminiDiagnostics?.finishReason || null],
            ['Gemini candidates', aiTrace.geminiDiagnostics?.candidateCount ?? null],
            ['Gemini response bytes', aiTrace.geminiDiagnostics?.responseByteLength ?? null],
            ['Gemini truncation signal', aiTrace.geminiDiagnostics
              ? (aiTrace.geminiDiagnostics.truncated
                  ? `Yes (${aiTrace.geminiDiagnostics.finishReason || 'incomplete Gemini response'})`
                  : 'No')
              : null],
            ['Spur suggestion', aiTrace.spurSuggestion.raw ? `${aiTrace.spurSuggestion.raw}${aiTrace.spurSuggestion.dropped ? ` → dropped: ${aiTrace.spurSuggestion.dropReason || 'no reason recorded'}` : ' → shown'}` : 'None'],
            ['Resolved spur', aiTrace.spurSuggestion.resolved || null],
            ['weekStandout', (() => {
              const weekStandout = aiTrace.weekStandout;
              if (weekStandout.parseStatus === 'parse-failure') return '⚠️ parse failure (fenced/malformed JSON) — dropped [ALERT]';
              if (weekStandout.parseStatus === 'absent' && weekStandout.finalValue) {
                return `absent from raw response → fallback used: "${weekStandout.finalValue}"`;
              }
              if (weekStandout.parseStatus === 'absent') return 'absent from raw response — model did not generate';
              if (weekStandout.decision === 'fallback-used') {
                return `present in raw response → replaced with fallback: "${weekStandout.finalValue || ''}"${weekStandout.fallbackReason ? ` (${weekStandout.fallbackReason})` : ''}`;
              }
              if (!weekStandout.used) return 'present in raw response (empty string) — not used';
              return `present in raw response → used: "${weekStandout.rawValue}"`;
            })()],
          ])}
          <div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Raw Groq response</div>
          <pre style="Margin:6px 0 0;padding:10px;background:${C.surfaceVariant};border:1px solid ${C.outline};border-radius:8px;white-space:pre-wrap;font-family:${MONO};font-size:11px;line-height:1.45;color:${C.ink};">${esc(aiTrace.rawGroqResponse || '(empty)')}</pre>
          ${aiTrace.rawGeminiResponse ? `<div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Raw Gemini response</div>
          <pre style="Margin:6px 0 0;padding:10px;background:${C.surfaceVariant};border:1px solid ${C.outline};border-radius:8px;white-space:pre-wrap;font-family:${MONO};font-size:11px;line-height:1.45;color:${C.ink};">${esc(aiTrace.rawGeminiResponse)}</pre>` : ''}
          <div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Normalized AI text</div>
          <div style="Margin-top:4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">${esc(aiTrace.normalizedAiText || '(empty)')}</div>
          <div style="Margin-top:10px;font-family:${FONT};font-size:12px;font-weight:700;line-height:1.4;color:${C.onPrimaryContainer};">Final AI text</div>
          <div style="Margin-top:4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};">${esc(aiTrace.finalAiText || '(empty)')}</div>
        `)}` : ''}
        ${spacer(8)}
        ${debugCard('Kit advisory rule trace', kitRows.length
          ? `${debugTable(
              ['Rule', 'Threshold', 'Value', 'Matched?', 'Shown?'],
              kitRows,
            )}${debugContext.kitAdvisory?.tipsShown?.length
              ? `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};"><span style="font-weight:700;color:${C.onPrimaryContainer};">Tips shown:</span> ${esc(debugContext.kitAdvisory.tipsShown.join(', '))}</div>`
              : `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">No tips shown — no rules matched.</div>`
            }`
          : `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">Kit advisory data not available for this run — ensure debugContext is passed into formatEmail.</div>`
        )}
        ${(() => {
          const outdoorComfort = debugContext.outdoorComfort;
          if (!outdoorComfort) {
            return `${spacer(8)}${debugCard('Outdoor comfort window trace', `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">No outdoor comfort data — tomorrow's hourly data may be absent.</div>`)}`;
          }
          const outdoorRows = outdoorComfort.hours.map(hour => ([
            esc(hour.hour),
            esc(`${hour.tmp}°C`),
            esc(`${hour.pp}%`),
            esc(`${hour.wind}km/h`),
            esc(`${hour.visK}km`),
            esc(`${hour.pr}mm`),
            esc(String(hour.comfortScore)),
            esc(hour.label),
          ]));
          const windowLine = outdoorComfort.bestWindow
            ? `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.ink};"><span style="font-weight:700;color:${C.onPrimaryContainer};">Best window:</span> ${esc(outdoorComfort.bestWindow.start)}–${esc(outdoorComfort.bestWindow.end)} (${esc(outdoorComfort.bestWindow.label)})</div>`
            : `<div style="Margin-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">No highlighted outdoor window found.</div>`;
          return `${spacer(8)}${debugCard('Outdoor comfort window trace', `${debugTable(['Hour', 'Temp', 'Rain', 'Wind', 'Vis', 'Precip', 'Score', 'Label'], outdoorRows)}${windowLine}`)}`;
        })()}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
