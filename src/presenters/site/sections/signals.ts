import { esc } from '../../../lib/utils.js';
import type { AuroraSignal } from '../../../lib/aurora-providers.js';
import { auroraVisibleKpThresholdForLat, isAuroraLikelyVisibleAtLat } from '../../../domain/editorial/aurora-visibility.js';
import { C } from '../../shared/brief-primitives.js';
import { resolveHomeLatitude, resolveHomeLocationName } from '../../../types/home-location.js';

const AWUK_LEVEL_META: Record<string, { label: string; fg: string; bg: string; border: string }> = {
  yellow: { label: 'Minor activity',    fg: C.warning, bg: C.warningContainer, border: '#EDD17B' },
  amber:  { label: 'Moderate activity', fg: C.warning, bg: C.warningContainer, border: '#DBA544' },
  red:    { label: 'Storm conditions',  fg: C.success, bg: C.successContainer, border: '#A3D9B1' },
};

function sPill(text: string, fg: string, bg: string, border: string): string {
  return `<span class="pill" style="color:${fg};background:${bg};border-color:${border};">${esc(text)}</span>`;
}

function sChip(label: string, value: string | number, tone?: string): string {
  const color = tone || C.primary;
  return `<span class="chip"><span class="chip-label" style="color:${color};">${esc(label)}</span>${value !== '' ? ` ${esc(String(value))}` : ''}</span>`;
}

function sCard(
  inner: string,
  opts: { accentSide?: 'top' | 'left'; accentColor?: string; extraClass?: string } = {},
): string {
  const { accentSide, accentColor, extraClass = '' } = opts;
  const accentClass = accentSide === 'top' ? ' card--top' : accentSide === 'left' ? ' card--left' : '';
  const accentStyle = accentSide && accentColor ? ` style="border-${accentSide}-color:${accentColor};"` : '';
  return `<div class="card${accentClass}${extraClass ? ` ${extraClass}` : ''}"${accentStyle}>${inner}</div>`;
}

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

export interface SignalCardsProps {
  shSunriseQ: number | null;
  shSunsetQ: number | null;
  shSunsetText: string | undefined;
  sunDir: number | null;
  crepPeak: number;
  metarNote: string | undefined;
  peakKpTonight?: number | null;
  auroraSignal?: AuroraSignal | null;
  locationName?: string;
  homeLatitude?: number;
}

export function sSignalCards(props: SignalCardsProps): string {
  const {
    shSunriseQ,
    shSunsetQ,
    shSunsetText,
    sunDir,
    crepPeak,
    metarNote,
    peakKpTonight,
    auroraSignal,
    locationName = resolveHomeLocationName(),
    homeLatitude = resolveHomeLatitude(),
  } = props;

  const cards: string[] = [];
  const awukLevel = auroraSignal?.nearTerm?.level;
  const awukFresh = auroraSignal?.nearTerm && !auroraSignal.nearTerm.isStale;
  const upcomingCmeCount = auroraSignal?.upcomingCmeCount ?? 0;
  const nextCmeArrival = auroraSignal?.nextCmeArrival;

  if (awukFresh && awukLevel && awukLevel !== 'green') {
    const meta = AWUK_LEVEL_META[awukLevel] ?? { label: awukLevel, fg: C.warning, bg: C.warningContainer, border: '#EDD17B' };
    const desc = awukLevelDescription(awukLevel, locationName, homeLatitude);
    cards.push(sCard(`
      <div class="card-overline">Space weather</div>
      <div class="card-headline">Aurora signal tonight</div>
      <div style="margin-top:10px;">${sPill(`AuroraWatch UK — ${meta.label}`, meta.fg, meta.bg, meta.border)}</div>
      <p class="card-body" style="margin-top:10px;">${esc(desc)}</p>
    `));
  } else if (peakKpTonight !== null && peakKpTonight !== undefined && peakKpTonight >= 5) {
    const kpDisplay = peakKpTonight.toFixed(1);
    const threshold = auroraVisibleKpThresholdForLat(homeLatitude);
    const visible = peakKpTonight >= threshold;
    const fg = visible ? C.success : C.warning;
    const bg = visible ? C.successContainer : C.warningContainer;
    const border = visible ? '#A3D9B1' : '#EDD17B';
    cards.push(sCard(`
      <div class="card-overline">Space weather</div>
      <div class="card-headline">Aurora signal tonight</div>
      <div style="margin-top:10px;">${sPill(`Kp ${kpDisplay}${visible ? ' — clears local threshold' : ' — watch threshold'}`, fg, bg, border)}</div>
      <p class="card-body" style="margin-top:10px;">${visible
        ? `Kp ${kpDisplay} exceeds the visibility threshold for ${locationName}. Best combined with a good astro window.`
        : `Kp ${kpDisplay} is approaching the local visibility threshold (~Kp ${threshold} at ${homeLatitude.toFixed(1)}°N). Worth watching overnight.`
      }</p>
    `));
  }

  if (upcomingCmeCount > 0 && nextCmeArrival) {
    const arrivalDate = new Date(nextCmeArrival);
    const arrivalStr = Number.isNaN(arrivalDate.getTime())
      ? nextCmeArrival
      : arrivalDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const cmeLabel = upcomingCmeCount === 1 ? 'Earth-directed CME' : `${upcomingCmeCount} Earth-directed CMEs`;
    cards.push(sCard(`
      <div class="card-overline">Aurora prediction</div>
      <div class="card-headline">CME forecast: ${esc(arrivalStr)}</div>
      <div style="margin-top:10px;">${sPill(`${cmeLabel} — NASA DONKI`, C.warning, C.warningContainer, '#EDD17B')}</div>
      <p class="card-body" style="margin-top:10px;">
        Elevated aurora probability around ${esc(arrivalStr)}. Monitor AuroraWatch UK as arrival approaches.
        Confidence is moderate — CME trajectory models carry uncertainty.
      </p>
    `));
  }

  if (shSunriseQ !== null || shSunsetQ !== null) {
    cards.push(sCard(`
      <div class="card-overline">Twilight signal</div>
      <div class="card-headline">SunsetHue outlook</div>
      <div class="chip-row" style="margin-top:10px;">
        ${sChip('Sunrise', `${shSunriseQ ?? '—'}%`, C.tertiary)}
        ${sChip('Sunset', `${shSunsetQ ?? '—'}%`, C.tertiary)}
      </div>
      <p class="card-body" style="margin-top:10px;">${esc(shSunsetText || 'No extra sky-texture note today.')}${sunDir !== null ? ` Sun direction ${Math.round(sunDir)}&deg;.` : ''}${crepPeak > 45 ? ` Rays ${crepPeak}/100.` : ''}</p>
    `));
  }

  if (metarNote) {
    cards.push(sCard(`
      <div class="card-overline">Live sky check</div>
      <div class="card-headline">Current METAR signal</div>
      <p class="card-body" style="margin-top:10px;">${esc(metarNote)}</p>
    `));
  }

  if (!cards.length) return '';
  return `<div class="section-stack">${cards.join('')}</div>`;
}
