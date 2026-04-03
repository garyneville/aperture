import { esc } from '../../../lib/utils.js';
import type { AuroraSignal } from '../../../lib/aurora-providers.js';
import {
  C,
  FONT,
  card,
  listRows,
  metricChip,
  pill,
} from '../shared.js';
import { auroraVisibleKpThresholdForLat } from '../../../lib/aurora-visibility.js';

const AWUK_LEVEL_META: Record<string, { label: string; fg: string; bg: string; border: string }> = {
  yellow: { label: 'Minor activity', fg: C.warning, bg: C.warningContainer, border: '#EDD17B' },
  amber: { label: 'Moderate activity', fg: C.warning, bg: C.warningContainer, border: '#DBA544' },
  red: { label: 'Storm conditions', fg: C.success, bg: C.successContainer, border: '#A3D9B1' },
};

function awukLevelDescription(level: string, locationName: string, homeLatitude: number): string {
  if (level === 'yellow') {
    return `Minor geomagnetic activity detected by UK magnetometers. Aurora may be visible from farther north; conditions at ${homeLatitude.toFixed(1)}°N (${locationName}) are marginal.`;
  }
  if (level === 'amber') {
    return `Moderate geomagnetic activity. Aurora may be visible from ${locationName} if skies stay clear.`;
  }
  if (level === 'red') {
    return `Storm-level geomagnetic activity. Aurora is plausible across much of the UK, including ${locationName}, on clear nights.`;
  }
  return `AuroraWatch UK status: ${level}.`;
}

export function signalCards(
  shSunriseQ: number | null,
  shSunsetQ: number | null,
  shSunsetText: string | undefined,
  sunDir: number | null,
  crepPeak: number,
  metarNote: string | undefined,
  peakKpTonight?: number | null,
  auroraSignal?: AuroraSignal | null,
  locationName = '',
  homeLatitude = 54,
): string {
  const cards: string[] = [];
  const awukLevel = auroraSignal?.nearTerm?.level;
  const awukFresh = auroraSignal?.nearTerm && !auroraSignal.nearTerm.isStale;
  const upcomingCmeCount = auroraSignal?.upcomingCmeCount ?? 0;
  const nextCmeArrival = auroraSignal?.nextCmeArrival;

  if (awukFresh && awukLevel && awukLevel !== 'green') {
    const meta = AWUK_LEVEL_META[awukLevel] ?? { label: awukLevel, fg: C.warning, bg: C.warningContainer, border: '#EDD17B' };
    const desc = awukLevelDescription(awukLevel, locationName, homeLatitude);
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Space weather</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">Aurora signal tonight</div>
      <div style="Margin-top:10px;">${pill(`AuroraWatch UK — ${meta.label}`, meta.fg, meta.bg, meta.border)}</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(desc)}</div>
    `));
  } else if (peakKpTonight !== null && peakKpTonight !== undefined && peakKpTonight >= 5) {
    const kpDisplay = peakKpTonight.toFixed(1);
    const threshold = auroraVisibleKpThresholdForLat(homeLatitude);
    const visible = peakKpTonight >= threshold;
    const fg = visible ? C.success : C.warning;
    const bg = visible ? C.successContainer : C.warningContainer;
    const border = visible ? '#A3D9B1' : '#EDD17B';
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Space weather</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">Aurora signal tonight</div>
      <div style="Margin-top:10px;">${pill(`Kp ${kpDisplay}${visible ? ' — clears local threshold' : ' — watch threshold'}`, fg, bg, border)}</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">
        ${visible
          ? `Kp ${kpDisplay} exceeds the visibility threshold for ${locationName}. Best combined with a good astro window.`
          : `Kp ${kpDisplay} is approaching the local visibility threshold (~Kp ${threshold} at ${homeLatitude.toFixed(1)}°N). Worth watching overnight.`}
      </div>
    `));
  }

  if (upcomingCmeCount > 0 && nextCmeArrival) {
    const arrivalDate = new Date(nextCmeArrival);
    const arrivalStr = Number.isNaN(arrivalDate.getTime())
      ? nextCmeArrival
      : arrivalDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const cmeLabel = upcomingCmeCount === 1 ? 'Earth-directed CME' : `${upcomingCmeCount} Earth-directed CMEs`;
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Aurora prediction</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">CME forecast: ${esc(arrivalStr)}</div>
      <div style="Margin-top:10px;">${pill(`${cmeLabel} — NASA DONKI`, C.warning, C.warningContainer, '#EDD17B')}</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">
        Elevated aurora probability around ${esc(arrivalStr)}. Monitor AuroraWatch UK as arrival approaches. Confidence is moderate — CME trajectory models carry uncertainty.
      </div>
    `));
  }

  if (shSunriseQ !== null || shSunsetQ !== null) {
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Twilight signal</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">SunsetHue outlook</div>
      <div style="Margin-top:10px;">
        ${metricChip('Sunrise', `${shSunriseQ ?? '-'}%`, C.tertiary)}
        ${metricChip('Sunset', `${shSunsetQ ?? '-'}%`, C.tertiary)}
      </div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">
        ${esc(shSunsetText || 'No extra sky-texture note today.')}${sunDir !== null ? ` Sun direction ${Math.round(sunDir)} degrees.` : ''}${crepPeak > 45 ? ` Rays ${crepPeak}/100.` : ''}
      </div>
    `));
  }

  if (metarNote) {
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Live sky check</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">Current METAR signal</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(metarNote)}</div>
    `));
  }

  return listRows(cards);
}
