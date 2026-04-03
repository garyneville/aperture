import { esc } from '../../lib/utils.js';
import { renderMainEmailDocument } from './email-layout.js';
import type { AuroraSignal } from '../../lib/aurora-providers.js';
import {
  BRAND_LOGO,
  C,
  FONT,
  SCORE_THRESHOLDS,
  type SummaryStat,
  card,
  creativeSpark,
  listRows,
  metricChip,
  pill,
  scorePill,
  scoreState,
  sectionTitle,
  spacer,
  summaryGrid,
} from './shared.js';
import {
  bestDaySessionLabel,
  bestTimeLabel,
  buildWindowDisplayPlan,
  clockToMinutes,
  displaySessionName,
  displayBestTags,
  displayTag,
  getRunTimeContext,
  isAstroWindow,
  localSummaryLines,
  moonAstroContext,
  moonDescriptor,
  peakHourForWindow,
  sessionConfidenceLabel,
  sessionRecommendationBody,
  sessionRecommendationHeadline,
  sessionRunnerUpLine,
  sessionVolatilityLabel,
  timeAwareLocalSummary,
  todayWindowSection,
  windowRange,
} from './time-aware.js';
import { auroraVisibleKpThresholdForLat } from '../../lib/aurora-visibility.js';
import { resolveHomeLatitude, resolveHomeLocationName } from '../../types/home-location.js';
import {
  buildKitTips,
  evaluateKitRules,
  kitAdvisoryCard,
} from './kit-advisory.js';
import {
  daylightUtilityTodayCard,
  nextDayHourlyOutlookSection,
  photoForecastCards,
  remainingTodayHourlyOutlookSection,
} from './next-day.js';
import type {
  AltLocation,
  DarkSkyAlertCard,
  DaySummary,
  FormatEmailInput,
  LongRangeCard,
  RunTimeContext,
  SpurOfTheMomentSuggestion,
} from './types.js';
import { confidenceDetail, effectiveConf } from './shared.js';

export { formatDebugEmail } from './debug-email.js';
export { buildKitTips, evaluateKitRules, type KitTip } from './kit-advisory.js';
export {
  nextDayHourlyOutlookSection,
  outdoorComfortLabel,
  outdoorComfortScore,
} from './next-day.js';
export type {
  AltLocation,
  CarWash,
  DarkSkyAlertCard,
  DaySummary,
  FormatEmailInput,
  LongRangeCard,
  NextDayHour,
  SpurOfTheMomentSuggestion,
  Window,
  WindowHour,
} from './types.js';

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

function signalCards(
  shSunriseQ: number | null,
  shSunsetQ: number | null,
  shSunsetText: string | undefined,
  sunDir: number | null,
  crepPeak: number,
  metarNote: string | undefined,
  peakKpTonight?: number | null,
  auroraSignal?: AuroraSignal | null,
  locationName = resolveHomeLocationName(),
  homeLatitude = resolveHomeLatitude(),
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

function buildSnowNote(snowDepthCm: number | null, snowfallCm: number | null): string {
  const parts: string[] = [];
  if (snowDepthCm !== null && snowDepthCm > 0) parts.push(`${snowDepthCm}cm snow on the ground`);
  if (snowfallCm !== null && snowfallCm > 0) parts.push(`${snowfallCm}cm snowfall expected`);
  return parts.join(' · ');
}

function alternativeSection(
  altLocations: AltLocation[] | undefined,
  closeContenders: AltLocation[] | undefined,
  noAltsMsg: string | undefined,
): string {
  if ((!altLocations || !altLocations.length) && (!closeContenders || !closeContenders.length)) {
    return card(`<div style="font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(noAltsMsg || 'No nearby locations score well enough today.')}</div>`);
  }

  const renderGroup = (title: string, locations: AltLocation[]): string => {
    if (!locations.length) return '';
    const rows = locations.map((loc, index) => {
      const note = loc.isAstroWin
        ? `Astro${loc.darkSky ? ' - dark sky' : ''} - best ${loc.bestAstroHour || 'evening'} - ${loc.driveMins} min drive`
        : `${bestDaySessionLabel(loc.bestDayHour)} - best ${loc.bestDayHour || 'time TBD'} - ${loc.driveMins} min drive`;
      const elevationChip = loc.isUpland && loc.elevationM
        ? metricChip('Elev', `${loc.elevationM}m`, C.secondary)
        : '';
      const snowNote = buildSnowNote(loc.snowDepthCm ?? null, loc.snowfallCm ?? null);
      return `<div style="${index < locations.length - 1 ? `padding:0 0 10px;border-bottom:1px solid ${C.outline};margin-bottom:10px;` : ''}">
        <div style="font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">${esc(loc.name)}</div>
        <div style="Margin-top:8px;">${scorePill(loc.bestScore)}</div>
        <div style="Margin-top:8px;">
          ${metricChip('AM', loc.amScore ?? 0, scoreState(loc.amScore ?? 0).fg)}
          ${metricChip('PM', loc.pmScore ?? 0, scoreState(loc.pmScore ?? 0).fg)}
          ${metricChip('Astro', loc.astroScore ?? 0, scoreState(loc.astroScore ?? 0).fg)}
          ${elevationChip}
        </div>
        <div style="Margin-top:8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(note)}</div>
        ${snowNote ? `<div style="Margin-top:4px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.secondary};"><span role="img" aria-label="snow">❄</span> ${esc(snowNote)}</div>` : ''}
      </div>`;
    }).join('');

    return `
      <div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};Margin:0 0 10px;">${esc(title)}</div>
      ${rows}
    `;
  };

  const renderCloseContenders = (locations: AltLocation[]): string => {
    if (!locations.length) return '';
    const rows = locations.map((loc, index) => {
      const bortle = typeof loc.siteDarkness?.bortle === 'number' ? ` · B${loc.siteDarkness.bortle}` : '';
      return `<div style="${index < locations.length - 1 ? `padding:0 0 10px;border-bottom:1px solid ${C.outline};margin-bottom:10px;` : ''}">
        <div style="font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">${esc(loc.name)}</div>
        <div style="Margin-top:8px;">${scorePill(loc.bestScore)}</div>
        <div style="Margin-top:8px;">
          ${metricChip('AM', loc.amScore ?? 0, scoreState(loc.amScore ?? 0).fg)}
          ${metricChip('PM', loc.pmScore ?? 0, scoreState(loc.pmScore ?? 0).fg)}
          ${metricChip('Astro', loc.astroScore ?? 0, scoreState(loc.astroScore ?? 0).fg)}
        </div>
        <div style="Margin-top:8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(`Darker-sky near miss - astro best ${loc.bestAstroHour || 'evening'} - ${loc.driveMins} min drive${bortle}`)}</div>
      </div>`;
    }).join('');

    return `
      <div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};Margin:0 0 10px;">Worth a look for darker skies</div>
      <div style="Margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">These do not clear the main trip threshold, but darker skies still make them worth a second look.</div>
      ${rows}
    `;
  };

  const astroAlternatives = (altLocations || []).filter(loc => loc.isAstroWin);
  const goldenHourAlternatives = (altLocations || []).filter(loc => !loc.isAstroWin);
  return card([
    renderGroup('Nearby astro options', astroAlternatives),
    renderGroup('Nearby landscape options', goldenHourAlternatives),
    renderCloseContenders(closeContenders || []),
  ].filter(Boolean).join(`<div style="height:14px;"></div>`));
}

function alternativeSummaryTitle(topAlternative: AltLocation | null | undefined, isCloseContender = false): string {
  if (!topAlternative) return 'Best nearby alternative';
  if (isCloseContender) return 'Nearby darker-sky contender';
  return topAlternative.isAstroWin ? 'Best nearby astro alternative' : 'Best nearby golden-hour alternative';
}

function alternativeTimingSummary(topAlternative: AltLocation | null | undefined): string {
  if (!topAlternative) return '';
  if (topAlternative.isAstroWin) return ` · astro from ${topAlternative.bestAstroHour || 'evening'}`;
  return ` · ${bestDaySessionLabel(topAlternative.bestDayHour).toLowerCase()} around ${topAlternative.bestDayHour || 'time TBD'}`;
}

function displayLongRangeLabel(cardLabel: string | null | undefined): string | null {
  if (!cardLabel) return null;
  return cardLabel === 'Weekend opportunity' ? 'Long-range opportunity' : cardLabel;
}

function departByTime(targetTime: string | null | undefined, driveMins: number): string | null {
  if (!targetTime || !/^\d{2}:\d{2}$/.test(targetTime)) return null;
  const [hours, minutes] = targetTime.split(':').map(Number);
  const targetMinutes = (hours * 60) + minutes;
  const departMinutes = ((targetMinutes - driveMins) % (24 * 60) + (24 * 60)) % (24 * 60);
  const departHours = Math.floor(departMinutes / 60);
  const departMins = departMinutes % 60;
  return `${String(departHours).padStart(2, '0')}:${String(departMins).padStart(2, '0')}`;
}

function longRangeFeasibilityNote(longRangeTop: LongRangeCard, runTime: RunTimeContext): { note: string; suppress: boolean } {
  const targetTime = longRangeTop.isAstroWin ? longRangeTop.bestAstroHour : longRangeTop.bestDayHour;
  const departBy = departByTime(targetTime, longRangeTop.driveMins);
  const windowType = longRangeTop.isAstroWin ? 'astro window' : 'light window';

  if (departBy && targetTime) {
    const departByMinutes = clockToMinutes(departBy);
    if (departByMinutes !== null) {
      const minutesUntilDeparture = departByMinutes - runTime.nowMinutes;
      if (minutesUntilDeparture < 0) {
        return { note: '', suppress: true };
      }
      if (minutesUntilDeparture < 60) {
        return {
          note: `Departure window closing - leave by ~${departBy} for the ${targetTime} ${windowType}.`,
          suppress: false,
        };
      }
      if (minutesUntilDeparture <= 180) {
        return {
          note: `Departing soon - leave by ~${departBy} for the ${targetTime} ${windowType}.`,
          suppress: false,
        };
      }
    }
  }

  if (longRangeTop.driveMins >= 180) {
    if (departBy && targetTime) {
      return {
        note: `Road-trip option - leave by ~${departBy} for the ${targetTime} ${windowType}. Overnight recommended.`,
        suppress: false,
      };
    }
    return {
      note: 'Road-trip option - best treated as a dedicated trip rather than a same-day short-notice run.',
      suppress: false,
    };
  }
  if (longRangeTop.driveMins >= 120) {
    if (departBy && targetTime) {
      return {
        note: `Long drive - leave by ~${departBy} for the ${targetTime} ${windowType}.`,
        suppress: false,
      };
    }
    return {
      note: 'Long drive - better as a planned outing than a casual detour.',
      suppress: false,
    };
  }
  if (longRangeTop.driveMins >= 90) {
    return {
      note: 'Long drive - better as a planned outing than a casual detour.',
      suppress: false,
    };
  }
  return { note: '', suppress: false };
}

function longRangeSection(
  longRangeTop: LongRangeCard | null | undefined,
  cardLabel: string | null | undefined,
  darkSkyAlert: DarkSkyAlertCard | null | undefined,
  runTime: RunTimeContext,
): string {
  const cards: string[] = [];
  const feasibility = longRangeTop ? longRangeFeasibilityNote(longRangeTop, runTime) : { note: '', suppress: false };

  if (longRangeTop && cardLabel && !feasibility.suppress) {
    const displayLabel = displayLongRangeLabel(cardLabel) || cardLabel;
    const regionLabel = longRangeTop.region.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    const timing = longRangeTop.isAstroWin
      ? `Best astro around ${longRangeTop.bestAstroHour || 'evening'}${longRangeTop.darkSky ? ' - dark sky site' : ''}`
      : `Best at ${longRangeTop.bestDayHour || 'time TBD'} - ${longRangeTop.tags.slice(0, 2).map(tag => displayTag(tag)).join(', ')}`;
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">${esc(displayLabel)}</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:18px;font-weight:600;line-height:1.24;letter-spacing:-0.01em;color:${C.ink};">${esc(longRangeTop.name)}</div>
      <div style="Margin-top:4px;font-family:${FONT};font-size:14px;line-height:1.4;color:${C.muted};">${esc(regionLabel)} &middot; ${longRangeTop.elevation}m &middot; ${longRangeTop.driveMins} min drive</div>
      <div style="Margin-top:10px;">${scorePill(longRangeTop.bestScore, longRangeTop.isAstroWin ? 'astro' : undefined)}</div>
      <div style="Margin-top:8px;">
        ${metricChip('AM', longRangeTop.amScore ?? 0, scoreState(longRangeTop.amScore ?? 0).fg)}
        ${metricChip('PM', longRangeTop.pmScore ?? 0, scoreState(longRangeTop.pmScore ?? 0).fg)}
        ${metricChip('Astro', longRangeTop.astroScore ?? 0, scoreState(longRangeTop.astroScore ?? 0).fg)}
      </div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(timing)}</div>
      ${feasibility.note ? `<div style="Margin-top:8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.secondary};">${esc(feasibility.note)}</div>` : ''}
    `, '', `border-top:3px solid ${C.secondary};`));
  }

  if (darkSkyAlert && (!longRangeTop || darkSkyAlert.name !== longRangeTop.name)) {
    cards.push(card(`
      <div style="Margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.subtle};">Dark sky alert</div>
      <div class="headline" style="Margin:0;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.3;color:${C.ink};">${esc(darkSkyAlert.name)}</div>
      <div style="Margin-top:10px;">${pill(`Astro ${darkSkyAlert.astroScore}/100`, C.success, C.successContainer, '#A3D9B1')}</div>
      <div style="Margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">
        Perfect conditions tonight from ${esc(darkSkyAlert.bestAstroHour || 'nightfall')} &middot; ${darkSkyAlert.driveMins} min drive
      </div>
    `));
  }

  return listRows(cards);
}

function spurOfTheMomentCard(spur: SpurOfTheMomentSuggestion): string {
  const regionLabel = spur.region.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  const tagChips = spur.tags.slice(0, 3).map(tag => metricChip(displayTag(tag), '')).join('');
  const darkSkyNote = spur.darkSky
    ? `<span style="font-family:${FONT};font-size:12px;color:${C.secondary};"><span role="img" aria-label="dark sky site">&#x2605;</span> Dark sky site</span>`
    : '';

  return card(`
    <div style="Margin:0 0 6px;font-family:${FONT};font-size:14px;font-weight:600;color:${C.ink};">${esc(spur.locationName)}</div>
    <div style="Margin:0 0 10px;font-family:${FONT};font-size:13px;color:${C.muted};">${esc(regionLabel)} &middot; ${spur.driveMins} min drive</div>
    <div style="font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};font-style:italic;">${esc(spur.hookLine)}</div>
    ${tagChips || darkSkyNote ? `<div style="Margin-top:10px;">${tagChips}${darkSkyNote}</div>` : ''}
  `, '', `border-left:3px solid ${C.primary};`);
}

function sessionRecommendationCard(sessionRecommendation: FormatEmailInput['sessionRecommendation']): string {
  const primary = sessionRecommendation?.primary;
  if (!primary) return '';

  const confidenceTone = primary.confidence === 'high'
    ? C.success
    : primary.confidence === 'medium'
      ? C.primary
      : C.warning;
  const volatility = sessionVolatilityLabel(primary);
  const runnerUp = sessionRunnerUpLine(sessionRecommendation);

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
  `, '', `border-left:3px solid ${scoreState(primary.score).fg};`);
}

export function formatEmail(input: FormatEmailInput): string {
  const {
    dontBother,
    windows,
    todayCarWash: todayCarWashData,
    dailySummary,
    altLocations,
    closeContenders,
    noAltsMsg,
    sunriseStr,
    sunsetStr,
    moonPct,
    metarNote,
    today,
    todayBestScore,
    shSunsetQ,
    shSunriseQ,
    shSunsetText,
    sunDir,
    crepPeak,
    aiText,
    compositionBullets,
    weekInsight,
    peakKpTonight,
    auroraSignal,
    longRangeTop,
    longRangeCardLabel,
    darkSkyAlert,
    spurOfTheMoment,
    geminiInspire,
    sessionRecommendation,
    debugContext,
  } = input;
  const homeLatitude = resolveHomeLatitude({ location: input.location, debugContext });
  const locationName = resolveHomeLocationName({ location: input.location, debugContext });

  const todayDay = dailySummary[0] || ({} as DaySummary);
  const runTime = getRunTimeContext(debugContext);
  const hasLocalWindow = (windows?.length || 0) > 0;
  const effectiveDontBother = dontBother || !hasLocalWindow;
  const displayPlan = buildWindowDisplayPlan(windows, runTime.nowMinutes);
  const topWindow = !effectiveDontBother ? displayPlan.primary : null;
  const heroScore = todayDay.headlineScore ?? todayBestScore;
  const peakLocalHour = effectiveDontBother
    ? null
    : peakHourForWindow(topWindow || undefined) || todayDay.bestPhotoHour;
  const todayScoreState = scoreState(heroScore);
  const topWindowIsAstro = isAstroWindow(topWindow || undefined);
  const { confidence: todayEffConf, stdDev: todayEffStdDev } = effectiveConf(todayDay, topWindowIsAstro);
  const todayConfidence = confidenceDetail(todayEffConf);
  const topPrimaryAlternative = altLocations?.[0] || null;
  const topCloseContender = closeContenders?.[0] || null;
  const topAlternative = topPrimaryAlternative || topCloseContender || todayDay.bestAlt || null;
  const topAlternativeIsCloseContender = !topPrimaryAlternative && !!topCloseContender && topAlternative?.name === topCloseContender.name;
  const nextWindow = !effectiveDontBother
    ? displayPlan.remaining.find(window => window !== topWindow) || null
    : null;
  const factStats: SummaryStat[] = [
    { label: 'Sunrise', value: sunriseStr, tone: C.primary },
    { label: 'Sunset', value: sunsetStr, tone: C.primary },
    { label: 'Moon', value: `${moonDescriptor(moonPct)} · ${moonPct}% lit`, tone: C.tertiary },
  ];

  if (todayConfidence) {
    factStats.push({
      label: 'Certainty',
      value: todayEffStdDev !== null && todayEffStdDev !== undefined
        ? `${todayConfidence.label} · spread ${todayEffStdDev} pts`
        : todayConfidence.label,
      tone: todayConfidence.fg,
    });
  }

  const scoreStats: SummaryStat[] = [
    { label: 'AM light', value: `${todayDay.amScore ?? 0}/100`, tone: scoreState(todayDay.amScore ?? 0).fg },
    { label: 'PM light', value: `${todayDay.pmScore ?? 0}/100`, tone: scoreState(todayDay.pmScore ?? 0).fg },
    { label: 'Peak astro', value: `${todayDay.astroScore ?? 0}/100`, tone: scoreState(todayDay.astroScore ?? 0).fg },
    { label: bestTimeLabel(topWindow, displayPlan.promotedFromPast), value: peakLocalHour || 'No clear slot', tone: C.onPrimaryContainer },
  ];

  const localSummary = effectiveDontBother
    ? (hasLocalWindow
        ? (sessionRecommendation?.primary
            ? `Overall conditions stay marginal, but ${displaySessionName(sessionRecommendation.primary.session).toLowerCase()} is the strongest specialist opportunity if you want to be selective.`
            : 'Not a great photography day locally — better to enjoy the outdoors instead.')
        : `No local window cleared the threshold today — treat ${locationName} as a pass unless you just want a walk.`)
    : timeAwareLocalSummary(displayPlan, topWindow, localSummaryLines(displayPlan, topWindow, todayDay));

  const spurMatchesTopAlt = !!spurOfTheMoment && !!topAlternative && spurOfTheMoment.locationName === topAlternative.name;
  const altSpurHook = spurMatchesTopAlt ? `\n"${spurOfTheMoment!.hookLine}"` : '';
  const altTimingNote = alternativeTimingSummary(topAlternative);
  const alternativeSummary = topAlternative
    ? `${topAlternative.name} · ${topAlternative.bestScore}/100 · ${topAlternative.driveMins} min drive${altTimingNote}${altSpurHook}`
    : '';

  const heroWindowLabel = topWindow
    ? `${displayPlan.allPast ? '<span style="font-weight:400;color:rgba(255,255,255,0.40);">Earlier today:</span><br>' : ''}${esc(topWindow.label)}<br><span style="font-weight:400;color:rgba(255,255,255,0.45);font-size:12px;">${esc(windowRange(topWindow))}</span>`
    : effectiveDontBother
      ? '<span style="font-weight:400;color:rgba(255,255,255,0.40);">No clear window today</span>'
      : '';

  const hero = card(`
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td valign="middle">
        <span style="color:${C.brand};margin-right:8px;vertical-align:middle;">${BRAND_LOGO}</span><span style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;vertical-align:middle;">Aperture</span>
      </td>
      <td align="right" valign="middle">
        <span style="font-family:${FONT};font-size:12px;font-weight:400;color:rgba(255,255,255,0.38);">${esc(locationName)}</span>
      </td>
    </tr>
  </table>
  <div style="height:1px;background:rgba(255,255,255,0.10);margin:14px 0 16px;"></div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="38%" valign="top">
        <div class="hero-score" style="font-family:${FONT};font-size:64px;font-weight:700;line-height:1;letter-spacing:-0.04em;color:${C.brand};">${heroScore}</div>
        <div style="font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-top:4px;">/ 100</div>
      </td>
      <td valign="top" style="padding-left:16px;border-left:1px solid rgba(255,255,255,0.10);">
        <div class="hero-title" style="font-family:${FONT};font-size:17px;font-weight:700;line-height:1.2;letter-spacing:0.02em;text-transform:uppercase;color:#FFFFFF;">${esc(todayScoreState.label)}</div>
        ${heroWindowLabel ? `<div style="font-family:${FONT};font-size:13px;font-weight:600;line-height:1.5;color:rgba(255,255,255,0.70);margin-top:8px;">${heroWindowLabel}</div>` : ''}
        <div style="font-family:${FONT};font-size:11px;color:rgba(255,255,255,0.38);margin-top:10px;">${esc(today)}</div>
      </td>
    </tr>
  </table>
  <div style="height:1px;background:rgba(255,255,255,0.10);margin:16px 0;"></div>
  <div style="border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.10);overflow:hidden;">${summaryGrid(factStats, 2)}</div>
  <div style="Margin-top:5px;padding:0 2px;font-family:${FONT};font-size:11px;color:rgba(255,255,255,0.36);">${moonAstroContext(moonPct)}</div>
  <div style="Margin-top:8px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.10);overflow:hidden;">${summaryGrid(scoreStats, 2)}</div>
  ${localSummary || alternativeSummary ? '<div style="height:1px;background:rgba(255,255,255,0.10);margin:14px 0 10px;"></div>' : ''}
  ${localSummary ? `<div style="font-family:${FONT};font-size:12px;line-height:1.55;color:rgba(255,255,255,0.60);">${esc(localSummary.replace(/\n/g, ' · '))}</div>` : ''}
  ${alternativeSummary ? `<div style="font-family:${FONT};font-size:11px;line-height:1.5;color:rgba(255,255,255,0.38);margin-top:5px;">${esc(alternativeSummaryTitle(topAlternative, topAlternativeIsCloseContender))}: ${esc(alternativeSummary)}</div>` : ''}
  `, 'hero-card', `background:linear-gradient(160deg, ${C.heroGradientStart} 0%, ${C.heroGradientEnd} 100%);border-color:rgba(255,255,255,0.08);`);

  const signals = signalCards(shSunriseQ, shSunsetQ, shSunsetText, sunDir, crepPeak, metarNote, peakKpTonight, auroraSignal, locationName, homeLatitude);
  const kitTips = buildKitTips(todayCarWashData, windows, todayDay.astroScore ?? 0, moonPct, 3, runTime.nowMinutes);
  const kitCard = kitAdvisoryCard(kitTips);

  if (debugContext) {
    const { trace, tipsShown } = evaluateKitRules(todayCarWashData, windows, todayDay.astroScore ?? 0, moonPct, 3, runTime.nowMinutes);
    debugContext.kitAdvisory = { rules: trace, tipsShown };
  }

  const tomorrow = dailySummary.find(day => day.dayIdx === 1);
  const remainingPhotoWindows = displayPlan.remaining.filter(window => window !== topWindow);
  const todayOutlookHtml = remainingTodayHourlyOutlookSection(
    todayDay,
    runTime,
    [topWindow, ...remainingPhotoWindows].filter((window): window is NonNullable<typeof window> => Boolean(window)),
    debugContext,
  );
  const tomorrowOutlookHtml = todayOutlookHtml
    ? ''
    : nextDayHourlyOutlookSection(tomorrow, debugContext);
  const outlookHtml = todayOutlookHtml || tomorrowOutlookHtml;
  const outlookSectionTitle = todayOutlookHtml ? 'Remaining today' : 'Tomorrow\'s weather';
  const longRangeHtml = longRangeSection(longRangeTop, longRangeCardLabel, darkSkyAlert, runTime);
  const sessionCard = sessionRecommendationCard(sessionRecommendation);
  const footerKey = `<div style="padding:12px 4px;border-top:1px solid ${C.outline};font-family:${FONT};font-size:11px;line-height:1.6;color:${C.subtle};">
    <b>Key</b> &middot;
    <b>Score bands</b> Excellent &ge; ${SCORE_THRESHOLDS.excellent} &middot; Good ${SCORE_THRESHOLDS.good}&ndash;${SCORE_THRESHOLDS.excellent - 1} &middot; Marginal ${SCORE_THRESHOLDS.marginal}&ndash;${SCORE_THRESHOLDS.good - 1} &middot; Poor &lt; ${SCORE_THRESHOLDS.marginal} &middot;
    AM/PM = sunrise &amp; sunset light quality &middot;
    Astro = night sky potential (clear skies + dark moon) &middot;
    Outdoor comfort = walk/run practicality, independent of photography scoring &middot;
    Crepuscular rays = shafts of light through broken cloud near the horizon &middot;
    Spread = how much forecast models disagree (lower is more reliable) &middot;
    Certainty bands = High &lt; 12 pts &middot; Fair 12&ndash;24 pts &middot; Low &ge; 25 pts &middot;
    Daylight spread = based on golden-hour ensemble &middot; Astro spread = based on night-hour ensemble
  </div>`;

  const sections: string[] = [
    `<tr><td>${hero}</td></tr>`,
    spacer(8),
    `<tr><td>${daylightUtilityTodayCard(todayCarWashData, runTime)}</td></tr>`,
  ];

  if (sessionCard) {
    sections.push(spacer(8), `<tr><td>${sessionCard}</td></tr>`);
  }

  if (signals) {
    sections.push(spacer(8), `<tr><td>${signals}</td></tr>`);
  }

  if (!effectiveDontBother) {
    sections.push(
      spacer(16),
      `<tr><td>${sectionTitle('Today\'s window')}</td></tr>`,
      `<tr><td>${todayWindowSection(effectiveDontBother, todayBestScore, aiText, windows, dailySummary, altLocations, runTime, peakKpTonight, compositionBullets, homeLatitude, locationName)}</td></tr>`,
    );
  }

  if (geminiInspire) {
    sections.push(spacer(8), `<tr><td>${creativeSpark(geminiInspire)}</td></tr>`);
  }

  if (kitCard) {
    sections.push(spacer(8), `<tr><td>${kitCard}</td></tr>`);
  }

  if (altLocations?.length || closeContenders?.length || longRangeTop) {
    sections.push(
      spacer(16),
      `<tr><td>${sectionTitle('Out of town options')}</td></tr>`,
      `<tr><td>${alternativeSection(altLocations, closeContenders, noAltsMsg)}</td></tr>`,
    );
    if (longRangeHtml) sections.push(spacer(12), `<tr><td>${longRangeHtml}</td></tr>`);
  }

  if (outlookHtml) {
    sections.push(
      spacer(16),
      `<tr><td>${sectionTitle(outlookSectionTitle)}</td></tr>`,
      `<tr><td>${outlookHtml}</td></tr>`,
    );
  }

  sections.push(spacer(16), `<tr><td>${sectionTitle('Days ahead')}</td></tr>`);
  if (weekInsight) {
    sections.push(
      `<tr><td>${card(`<div style="font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(weekInsight)}</div>`, '', `border-left:3px solid ${C.tertiary};`)}</td></tr>`,
      spacer(8),
    );
  }
  sections.push(`<tr><td>${photoForecastCards(dailySummary)}</td></tr>`);

  if (spurOfTheMoment && !spurMatchesTopAlt) {
    sections.push(
      spacer(16),
      `<tr><td>${sectionTitle('Spur of the moment')}</td></tr>`,
      `<tr><td>${spurOfTheMomentCard(spurOfTheMoment)}</td></tr>`,
    );
  }

  sections.push(spacer(16), `<tr><td>${footerKey}</td></tr>`);
  return renderMainEmailDocument(sections.join(''));
}
