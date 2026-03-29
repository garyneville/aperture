import { esc } from './utils.js';
import { renderSiteDocument } from './site-layout.js';
import type { AuroraSignal } from './aurora-providers.js';
import {
  BRAND_LOGO,
  C,
  SCORE_THRESHOLDS,
  type SummaryStat,
  confidenceDetail,
  dayHeading,
  dewRiskEntry,
  effectiveConf,
  moonIconForPct,
  scoreState,
  weatherIconForHour,
} from '../renderers/shared/brief-primitives.js';
import {
  bestDaySessionLabel,
  bestTimeLabel,
  buildWindowDisplayPlan,
  classifyWindowTiming,
  clockToMinutes,
  displayTag,
  forecastBestLine,
  getRunTimeContext,
  isAstroWindow,
  localSummaryLines,
  minutesToClock,
  moonAstroContext,
  moonDescriptor,
  peakHourForWindow,
  timeAwareBriefingFallback,
  timeAwareLocalSummary,
  windowRange,
} from './format-email/time-aware.js';
import { buildKitTips } from './format-email/kit-advisory.js';
import {
  outdoorComfortLabel,
  outdoorComfortScore,
} from './format-email/next-day.js';
import { renderAiBriefingText } from './ai-briefing.js';
import { auroraVisibleKpThresholdForLat, isAuroraLikelyVisibleAtLat } from './aurora-visibility.js';
import { resolveHomeLatitude, resolveHomeLocationName } from '../types/home-location.js';
import type {
  AltLocation,
  BriefRenderInput as FormatEmailInput,
  DarkSkyAlertCard,
  DaySummary,
  LongRangeCard,
  RunTimeContext,
  SpurOfTheMomentSuggestion,
  Window,
  WindowHour,
} from '../types/brief.js';

// ── Score state using CSS classes rather than inline hex ──────────────────────

function siteScoreClass(score: number): string {
  if (score >= SCORE_THRESHOLDS.excellent) return 'score-excellent';
  if (score >= SCORE_THRESHOLDS.good) return 'score-good';
  if (score >= SCORE_THRESHOLDS.marginal) return 'score-marginal';
  return 'score-poor';
}

// ── Primitive components ──────────────────────────────────────────────────────

function sPill(text: string, fg: string, bg: string, border: string): string {
  return `<span class="pill" style="color:${fg};background:${bg};border-color:${border};">${esc(text)}</span>`;
}

function sScorePill(score: number, suffix?: string): string {
  const state = scoreState(score);
  const label = `${state.label} — ${score}/100${suffix ? ` ${suffix}` : ''}`;
  return `<span class="pill ${siteScoreClass(score)}">${esc(label)}</span>`;
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

function sSection(title: string): string {
  return `<h2 class="section-heading">${esc(title)}</h2>`;
}

function sMetricRun(items: Array<{ label: string; value: string | number; tone?: string }>): string {
  return items.map((item, index) => {
    const color = item.tone || C.primary;
    const sep = index < items.length - 1 ? `<span class="metric-run-sep">&middot;</span>` : '';
    return `<span><span style="font-weight:600;color:${color};">${esc(item.label)}</span> ${esc(String(item.value))}</span>${sep}`;
  }).join('');
}

function sHtmlText(text: string): string {
  const safe = esc(text || '');
  return `<div class="ai-body">${
    safe
      .split(/\n{2,}/)
      .map(chunk => `<p>${chunk.replace(/\n/g, '<br>')}</p>`)
      .join('')
  }</div>`;
}

// ── AWUK signal cards ─────────────────────────────────────────────────────────

const AWUK_LEVEL_META: Record<string, { label: string; fg: string; bg: string; border: string }> = {
  yellow: { label: 'Minor activity',    fg: C.warning, bg: C.warningContainer, border: '#EDD17B' },
  amber:  { label: 'Moderate activity', fg: C.warning, bg: C.warningContainer, border: '#DBA544' },
  red:    { label: 'Storm conditions',  fg: C.success, bg: C.successContainer, border: '#A3D9B1' },
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

function sSignalCards(
  shSunriseQ: number | null,
  shSunsetQ: number | null,
  shSunsetText: string | undefined,
  sunDir: number | null,
  crepPeak: number,
  metarNote: string | undefined,
  peakKpTonight?: number | null,
  auroraSignal?: AuroraSignal | null,
  locationName = 'Leeds',
  homeLatitude = 53.82703,
): string {
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

// ── Daylight utility bar ──────────────────────────────────────────────────────

const UTILITY_GLYPHS = '<span aria-hidden="true">🚗 / 🚶</span>';

function sDaylightUtilityBar(
  todayCarWash: FormatEmailInput['todayCarWash'],
  runTime: RunTimeContext,
): string {
  const startMinutes = clockToMinutes(todayCarWash.start);
  const endMinutes = clockToMinutes(todayCarWash.end);
  const isPast = startMinutes !== null && endMinutes !== null && endMinutes < runTime.nowMinutes;
  if (isPast) return '';

  const state = todayCarWash.score >= 75
    ? { fg: C.success,              bg: C.successContainer,  border: '#A3D9B1' }
    : todayCarWash.score >= 50
      ? { fg: C.onPrimaryContainer, bg: C.primaryContainer,  border: '#A8D4FB' }
      : { fg: C.error,              bg: C.errorContainer,    border: '#ECACA5' };

  const isOngoing = startMinutes !== null && endMinutes !== null
    && startMinutes <= runTime.nowMinutes && endMinutes >= runTime.nowMinutes;
  const clippedStart = isOngoing
    ? minutesToClock(runTime.nowMinutes % 60 === 0 ? runTime.nowMinutes : runTime.nowMinutes + (60 - (runTime.nowMinutes % 60)))
    : todayCarWash.start;
  const windowStr = todayCarWash.start !== '\u2014' ? `${clippedStart}\u2013${todayCarWash.end}` : '\u2014';
  const utilityLabel = isOngoing ? 'Daylight utility now' : 'Daylight utility';

  return `<div class="card card--surface-variant">
    <div class="utility-bar">
      <div class="utility-bar-left">
        <span class="utility-label">${utilityLabel}</span>
        <span class="utility-window">${UTILITY_GLYPHS} ${esc(windowStr)}</span>
      </div>
      <div>${sPill(`${todayCarWash.rating} ${todayCarWash.label}`, state.fg, state.bg, state.border)}</div>
    </div>
    <div class="chip-row" style="margin-top:8px;">
      ${sChip('Wind', `${todayCarWash.wind}km/h`, C.tertiary)}
      ${sChip('Rain', `${todayCarWash.pp}%`, C.error)}
      ${sChip('Temp', `${todayCarWash.tmp ?? '—'}\u00b0C`, C.secondary)}
    </div>
  </div>`;
}

// ── Window section ────────────────────────────────────────────────────────────

function sWindowCard(
  window: Window,
  index: number,
  allWindows: Window[],
  sectionLabel: string,
  peakKpTonight?: number | null,
  homeLatitude?: number | null,
): string {
  const hour: WindowHour = window.hours?.find(e => e.score === window.peak) || window.hours?.[0] || {} as WindowHour;
  const notes: string[] = [];
  const resolvedHomeLatitude = resolveHomeLatitude({ homeLatitude });

  if (window.fallback) notes.push('Most promising narrow stretch rather than a clean standout window.');
  if ((hour.crepuscular || 0) > 45) notes.push(`Crepuscular ray potential: ${hour.crepuscular}/100 (light shafts through broken cloud).`);
  if (window.darkPhaseStart && window.postMoonsetScore !== null && window.postMoonsetScore !== undefined) {
    notes.push(`Dark from ${window.darkPhaseStart} — peak after moonset ${window.postMoonsetScore}/100.`);
  }
  if (index === 0 && isAstroWindow(window) && isAuroraLikelyVisibleAtLat(resolvedHomeLatitude, peakKpTonight)) {
    const threshold = auroraVisibleKpThresholdForLat(resolvedHomeLatitude);
    notes.push(`Coincides with an active aurora signal (Kp ${peakKpTonight?.toFixed(1) ?? 'unknown'} vs local threshold Kp ${threshold}) — favour a clean northern horizon.`);
  }
  if (index > 0 && isAstroWindow(allWindows[0]) && isAstroWindow(window) && allWindows[0]?.label !== window.label) {
    notes.push('Later, darker backup if you miss the first astro slot.');
  }

  const metricLine = sMetricRun([
    { label: 'Cloud high',  value: `${hour.ch ?? '—'}%`,    tone: C.primary },
    { label: 'Visibility',  value: `${hour.visK ?? '—'}km`, tone: C.secondary },
    { label: 'Wind',        value: `${hour.wind ?? '—'}km/h`, tone: C.tertiary },
    { label: 'Rain',        value: `${hour.pp ?? '—'}%`,    tone: C.error },
    ...dewRiskEntry(hour.tpw, hour.tmp),
  ]);

  const tagChips = (window.tops || []).length
    ? `<div class="chip-row" style="margin-top:10px;">${(window.tops || []).map(tag => sChip(displayTag(tag), '', C.primary)).join('')}</div>`
    : '';

  const noteBlock = notes.length
    ? `<div class="card-body" style="margin-top:10px;padding-top:12px;border-top:1px solid var(--c-outline);">${esc(notes.join(' '))}</div>`
    : '';

  return sCard(`
    <div class="card-overline">${esc(sectionLabel)}</div>
    <div class="card-headline">${esc(window.label)}</div>
    <div class="card-body" style="margin-top:4px;">${esc(windowRange(window))}</div>
    <div style="margin-top:10px;">${sScorePill(window.peak)}</div>
    <div class="metric-run" style="margin-top:10px;">${metricLine}</div>
    ${tagChips}
    ${noteBlock}
  `, { accentSide: index === 0 ? 'top' : undefined, accentColor: index === 0 ? scoreState(window.peak).fg : undefined });
}

function sWindowSection(
  dontBother: boolean,
  todayBestScore: number,
  aiText: string,
  windows: Window[] | undefined,
  dailySummary: DaySummary[],
  altLocations: AltLocation[] | undefined,
  runTime: RunTimeContext,
  peakKpTonight: number | null | undefined,
  compositionBullets?: string[],
  homeLatitude?: number | null,
  homeLocationName?: string | null,
): string {
  const hasLocalWindow = (windows?.length || 0) > 0;
  const effectiveDontBother = dontBother || !hasLocalWindow;
  const displayPlan = buildWindowDisplayPlan(windows, runTime.nowMinutes);

  if (effectiveDontBother) {
    const headline = hasLocalWindow ? 'Not worth shooting locally' : 'No clear local window';
    const fallbackWindow = windows?.[0];
    const peakHour = fallbackWindow
      ? peakHourForWindow(fallbackWindow) || fallbackWindow.end || fallbackWindow.start
      : null;
    const fallbackLine = fallbackWindow
      ? `If you still go: ${fallbackWindow.label.toLowerCase()} around ${peakHour || 'time TBD'} at ${fallbackWindow.peak}/100.`
      : 'If you still go: no clear local fallback window.';
    return sCard(`
      <div class="card-overline" style="color:${C.error};">Today&apos;s call</div>
      <div class="card-headline">${headline}</div>
      <div style="margin-top:10px;">${sScorePill(todayBestScore)}</div>
      <p class="card-body" style="margin-top:10px;">${esc(fallbackLine)}</p>
    `, { accentSide: 'top', accentColor: C.error });
  }

  const fallbackAiText = timeAwareBriefingFallback(displayPlan);
  const renderedAi = fallbackAiText
    ? { text: fallbackAiText }
    : renderAiBriefingText(aiText, { dontBother, windows, dailySummary, altLocations, peakKpTonight, homeLatitude, homeLocationName });
  const trimmedAiText = renderedAi.text || aiText;

  const windowCards: string[] = [];
  if (!displayPlan.allPast && displayPlan.primary) {
    const primaryLabel = displayPlan.promotedFromPast
      ? 'Next window'
      : classifyWindowTiming(displayPlan.primary, runTime.nowMinutes) === 'current'
        ? 'Live now'
        : 'Best window';
    const allDisplayWindows = [displayPlan.primary, ...displayPlan.remaining.filter(w => w !== displayPlan.primary)];
    windowCards.push(sWindowCard(displayPlan.primary, 0, allDisplayWindows, primaryLabel, peakKpTonight, homeLatitude));
    displayPlan.remaining
      .filter(w => w !== displayPlan.primary)
      .forEach((w, i) => windowCards.push(sWindowCard(w, i + 1, displayPlan.remaining, 'Later today', peakKpTonight, homeLatitude)));
  }
  displayPlan.past.forEach((w, i) => windowCards.push(sWindowCard(w, i + 1, displayPlan.past, 'Earlier today', peakKpTonight, homeLatitude)));

  const aiCard = sCard(`
    <div class="ai-overline">AI briefing</div>
    ${sHtmlText(trimmedAiText)}
  `);

  const compCard = !fallbackAiText && compositionBullets?.length
    ? sCard(`
        <div class="card-overline">Shot ideas</div>
        <ul class="bullet-list" style="margin-top:4px;">
          ${compositionBullets.map(b => `<li>${esc(b)}</li>`).join('')}
        </ul>
      `, { accentSide: 'left', accentColor: C.secondary })
    : '';

  return `<div class="section-stack">${[...windowCards, aiCard, compCard].filter(Boolean).join('')}</div>`;
}

// ── Creative spark ────────────────────────────────────────────────────────────

function sCreativeSpark(text: string): string {
  return `<div class="card">
    <div class="spark-overline">&#x2736; Creative spark</div>
    <div class="spark-quote-mark">&ldquo;</div>
    <div class="spark-text">${esc(text)}</div>
  </div>`;
}

// ── Kit advisory ──────────────────────────────────────────────────────────────

function sKitAdvisoryCard(tips: Array<{ text: string }>): string {
  if (!tips.length) return '';
  return sCard(`
    <div class="card-overline">Kit advisory</div>
    <ul class="kit-list" style="margin-top:4px;">
      ${tips.map(tip => `<li>${esc(tip.text)}</li>`).join('')}
    </ul>
  `, { accentSide: 'left', accentColor: C.tertiary });
}

// ── Alternative locations ─────────────────────────────────────────────────────

function sLocationItem(loc: AltLocation, isLast: boolean, noteOverride?: string): string {
  const note = noteOverride ?? (loc.isAstroWin
    ? `Astro${loc.darkSky ? ' — dark sky' : ''} — best ${loc.bestAstroHour || 'evening'} — ${loc.driveMins} min drive`
    : `${bestDaySessionLabel(loc.bestDayHour)} — best ${loc.bestDayHour || 'time TBD'} — ${loc.driveMins} min drive`);
  const elevationChip = loc.isUpland && loc.elevationM
    ? sChip('Elev', `${loc.elevationM}m`, C.secondary)
    : '';
  const snowParts: string[] = [];
  if (loc.snowDepthCm) snowParts.push(`${loc.snowDepthCm}cm on ground`);
  if (loc.snowfallCm) snowParts.push(`${loc.snowfallCm}cm expected`);
  const snowLine = snowParts.length
    ? `<div class="card-body" style="margin-top:4px;color:${C.secondary};">&#x2745; ${esc(snowParts.join(' · '))}</div>`
    : '';

  return `<div class="${isLast ? '' : 'location-item'}">
    <div class="location-name">${esc(loc.name)}</div>
    <div style="margin-top:6px;">${sScorePill(loc.bestScore)}</div>
    <div class="chip-row" style="margin-top:8px;">
      ${sChip('AM',    loc.amScore    ?? 0, scoreState(loc.amScore    ?? 0).fg)}
      ${sChip('PM',    loc.pmScore    ?? 0, scoreState(loc.pmScore    ?? 0).fg)}
      ${sChip('Astro', loc.astroScore ?? 0, scoreState(loc.astroScore ?? 0).fg)}
      ${elevationChip}
    </div>
    <p class="location-note">${esc(note)}</p>
    ${snowLine}
  </div>`;
}

function sAlternativeSection(
  altLocations: AltLocation[] | undefined,
  closeContenders: AltLocation[] | undefined,
  noAltsMsg: string | undefined,
): string {
  if ((!altLocations || !altLocations.length) && (!closeContenders || !closeContenders.length)) {
    return sCard(`<p class="card-body">${esc(noAltsMsg || 'No nearby locations score well enough today.')}</p>`);
  }

  const astroAlts = (altLocations || []).filter(loc => loc.isAstroWin);
  const dayAlts   = (altLocations || []).filter(loc => !loc.isAstroWin);
  const contenders = closeContenders || [];
  const sections: string[] = [];

  if (astroAlts.length) {
    sections.push(`<div>
      <div class="card-overline" style="margin-bottom:10px;">Nearby astro options</div>
      ${astroAlts.map((loc, i) => sLocationItem(loc, i === astroAlts.length - 1)).join('')}
    </div>`);
  }

  if (dayAlts.length) {
    sections.push(`<div${astroAlts.length ? ' style="margin-top:14px;"' : ''}>
      <div class="card-overline" style="margin-bottom:10px;">Nearby landscape options</div>
      ${dayAlts.map((loc, i) => sLocationItem(loc, i === dayAlts.length - 1)).join('')}
    </div>`);
  }

  if (contenders.length) {
    sections.push(`<div style="margin-top:14px;">
      <div class="card-overline" style="margin-bottom:8px;">Worth a look for darker skies</div>
      <p class="card-body" style="margin-bottom:10px;">These do not clear the main trip threshold, but darker skies still make them worth a second look.</p>
      ${contenders.map((loc, i) => {
        const bortle = typeof loc.siteDarkness?.bortle === 'number' ? ` · B${loc.siteDarkness.bortle}` : '';
        return sLocationItem(
          loc,
          i === contenders.length - 1,
          `Darker-sky near miss — astro best ${loc.bestAstroHour || 'evening'} — ${loc.driveMins} min drive${bortle}`,
        );
      }).join('')}
    </div>`);
  }

  return sCard(sections.join(''));
}

// ── Long range section ────────────────────────────────────────────────────────

function departByTime(targetTime: string | null | undefined, driveMins: number): string | null {
  if (!targetTime || !/^\d{2}:\d{2}$/.test(targetTime)) return null;
  const [hours, mins] = targetTime.split(':').map(Number);
  const targetMinutes = (hours * 60) + mins;
  const departMinutes = ((targetMinutes - driveMins) % (24 * 60) + (24 * 60)) % (24 * 60);
  const dh = Math.floor(departMinutes / 60);
  const dm = departMinutes % 60;
  return `${String(dh).padStart(2, '0')}:${String(dm).padStart(2, '0')}`;
}

function longRangeFeasibilityNote(top: LongRangeCard, runTime: RunTimeContext): { note: string; suppress: boolean } {
  const targetTime = top.isAstroWin ? top.bestAstroHour : top.bestDayHour;
  const departBy = departByTime(targetTime, top.driveMins);
  const windowType = top.isAstroWin ? 'astro window' : 'light window';
  if (departBy && targetTime) {
    const departByMinutes = clockToMinutes(departBy);
    if (departByMinutes !== null) {
      const minutesUntilDeparture = departByMinutes - runTime.nowMinutes;
      if (minutesUntilDeparture < 0) {
        return { note: '', suppress: true };
      }
      if (minutesUntilDeparture < 60) {
        return {
          note: `Departure window closing — leave by ~${departBy} for the ${targetTime} ${windowType}.`,
          suppress: false,
        };
      }
      if (minutesUntilDeparture <= 180) {
        return {
          note: `Departing soon — leave by ~${departBy} for the ${targetTime} ${windowType}.`,
          suppress: false,
        };
      }
    }
  }
  if (top.driveMins >= 180) {
    return {
      note: departBy && targetTime
        ? `Road-trip option — leave by ~${departBy} for the ${targetTime} ${windowType}. Overnight recommended.`
        : 'Road-trip option — best treated as a dedicated trip rather than a same-day short-notice run.',
      suppress: false,
    };
  }
  if (top.driveMins >= 120) {
    return {
      note: departBy && targetTime
        ? `Long drive — leave by ~${departBy} for the ${targetTime} ${windowType}.`
        : 'Long drive — better as a planned outing than a casual detour.',
      suppress: false,
    };
  }
  if (top.driveMins >= 90) {
    return {
      note: 'Long drive — better as a planned outing than a casual detour.',
      suppress: false,
    };
  }
  return { note: '', suppress: false };
}

function sLongRangeSection(
  longRangeTop: LongRangeCard | null | undefined,
  cardLabel: string | null | undefined,
  darkSkyAlert: DarkSkyAlertCard | null | undefined,
  runTime: RunTimeContext,
): string {
  const cards: string[] = [];
  const feasibility = longRangeTop ? longRangeFeasibilityNote(longRangeTop, runTime) : { note: '', suppress: false };

  if (longRangeTop && cardLabel && !feasibility.suppress) {
    const displayLabel = cardLabel === 'Weekend opportunity' ? 'Long-range opportunity' : cardLabel;
    const regionLabel = longRangeTop.region.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const timing = longRangeTop.isAstroWin
      ? `Best astro around ${longRangeTop.bestAstroHour || 'evening'}${longRangeTop.darkSky ? ' — dark sky site' : ''}`
      : `Best at ${longRangeTop.bestDayHour || 'time TBD'} — ${longRangeTop.tags.slice(0, 2).map(displayTag).join(', ')}`;

    cards.push(sCard(`
      <div class="card-overline">${esc(displayLabel)}</div>
      <div class="card-headline card-headline--lg">${esc(longRangeTop.name)}</div>
      <p class="card-body" style="margin-top:4px;">${esc(regionLabel)} &middot; ${longRangeTop.elevation}m &middot; ${longRangeTop.driveMins} min drive</p>
      <div style="margin-top:10px;">${sScorePill(longRangeTop.bestScore, longRangeTop.isAstroWin ? 'astro' : undefined)}</div>
      <div class="chip-row" style="margin-top:8px;">
        ${sChip('AM',    longRangeTop.amScore    ?? 0, scoreState(longRangeTop.amScore    ?? 0).fg)}
        ${sChip('PM',    longRangeTop.pmScore    ?? 0, scoreState(longRangeTop.pmScore    ?? 0).fg)}
        ${sChip('Astro', longRangeTop.astroScore ?? 0, scoreState(longRangeTop.astroScore ?? 0).fg)}
      </div>
      <p class="card-body" style="margin-top:10px;">${esc(timing)}</p>
      ${feasibility.note ? `<p class="card-body" style="margin-top:8px;color:${C.secondary};">${esc(feasibility.note)}</p>` : ''}
    `, { accentSide: 'top', accentColor: C.secondary }));
  }

  if (darkSkyAlert && (!longRangeTop || darkSkyAlert.name !== longRangeTop.name)) {
    cards.push(sCard(`
      <div class="card-overline">Dark sky alert</div>
      <div class="card-headline">${esc(darkSkyAlert.name)}</div>
      <div style="margin-top:10px;">${sPill(`Astro ${darkSkyAlert.astroScore}/100`, C.success, C.successContainer, '#A3D9B1')}</div>
      <p class="card-body" style="margin-top:10px;">
        Perfect conditions tonight from ${esc(darkSkyAlert.bestAstroHour || 'nightfall')} &middot; ${darkSkyAlert.driveMins} min drive
      </p>
    `));
  }

  if (!cards.length) return '';
  return `<div class="section-stack">${cards.join('')}</div>`;
}

// ── Hourly outlook ────────────────────────────────────────────────────────────

function sForecastMoonPct(day: DaySummary): number | null {
  const hours = day.hours || [];
  const bestAstroHour = day.bestAstroHour
    ? hours.find(h => h.hour === day.bestAstroHour && typeof h.moon === 'number')
    : null;
  const representative = bestAstroHour
    || hours.find(h => h.isNight && typeof h.moon === 'number')
    || hours.find(h => typeof h.moon === 'number')
    || null;
  return typeof representative?.moon === 'number' ? Math.round(representative.moon) : null;
}

function sHourFallsWithinPhotoWindow(hour: string, window: Window): boolean {
  const hourMinutes = clockToMinutes(hour);
  const startMinutes = clockToMinutes(window.start);
  const endMinutes = clockToMinutes(window.end);
  if (hourMinutes === null || startMinutes === null || endMinutes === null) return false;
  if (endMinutes < startMinutes) {
    return hourMinutes >= startMinutes || hourMinutes <= endMinutes;
  }
  return hourMinutes >= startMinutes && hourMinutes <= endMinutes;
}

function sHourlyOutlookSection(
  day: DaySummary | undefined,
  opts: {
    title: string;
    caption: string;
    summaryContext: 'today' | 'tomorrow';
    startAtMinutes?: number | null;
    showOvernight?: boolean;
    photoWindows?: Window[];
  },
): string {
  if (!day?.hours?.length) return '';

  const hours = day.hours
    .filter(h => opts.startAtMinutes == null || (clockToMinutes(h.hour) ?? -1) >= opts.startAtMinutes)
    .filter(h => {
      if (opts.showOvernight) return true;
      if ((opts.photoWindows || []).some(window => sHourFallsWithinPhotoWindow(h.hour, window))) return true;
      const mins = clockToMinutes(h.hour) ?? 0;
      return !h.isNight || (mins >= 18 * 60 && mins < 23 * 60);
    });

  if (!hours.length) return '';

  const dayHours = hours.filter(h => !h.isNight);
  const avgTmp = dayHours.length
    ? Math.round(dayHours.reduce((s, h) => s + h.tmp, 0) / dayHours.length)
    : null;
  const maxPp   = dayHours.length ? Math.max(...dayHours.map(h => h.pp))   : 0;
  const maxWind = dayHours.length ? Math.max(...dayHours.map(h => h.wind)) : 0;
  const rainNote = maxPp > 60 ? 'Heavy rain likely' : maxPp > 30 ? 'Some rain likely' : maxPp > 10 ? 'Chance of showers' : 'Mostly dry';
  const windNote = maxWind > 40 ? ' with strong winds' : maxWind > 25 ? ' with breezy spells' : '';
  const summaryLine = avgTmp !== null ? `${rainNote}${windNote}. Around ${avgTmp}\u00b0C.` : `${rainNote}${windNote}.`;

  const rows = hours.map(h => {
    const comfort = outdoorComfortScore(h);
    const label   = outdoorComfortLabel(comfort, h);
    const rowBg   = label.highlight ? `${label.bg}33` : 'transparent';
    const dot     = label.highlight ? `<span style="color:${label.fg};">&#x25CF;</span>` : `<span style="color:var(--c-outline);">&#x25CB;</span>`;
    return `<tr style="background:${rowBg};">
      <td style="font-size:12px;font-weight:600;">${esc(h.hour)}</td>
      <td class="col-sky">${weatherIconForHour(h, 18)}</td>
      <td>${Math.round(h.tmp)}\u00b0C</td>
      <td>${h.pp}%</td>
      <td>${h.wind}km/h</td>
      <td class="col-comfort">${dot}&ensp;${esc(label.text)}</td>
      <td style="color:var(--c-subtle);">${comfort}/100</td>
    </tr>`;
  }).join('');

  return sCard(`
    <div class="card-overline">${esc(opts.title)}</div>
    <p class="card-body" style="margin-top:4px;">${esc(summaryLine)}</p>
    <div class="hourly-scroll">
      <table class="hourly-table">
        <caption>${esc(opts.caption)}</caption>
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

// ── Days ahead forecast ───────────────────────────────────────────────────────

function sPhotoForecastCards(dailySummary: DaySummary[]): string {
  const days = dailySummary.filter(d => d.dayIdx >= 1).slice(0, 4);
  return `<div class="section-stack">${days.map(day => {
    const dayIsAstroLed = (day.astroScore ?? 0) > (day.photoScore ?? 0);
    const { confidence: effConf } = effectiveConf(day, dayIsAstroLed);
    const displayScore = day.headlineScore ?? day.photoScore;
    const confState = confidenceDetail(effConf);
    const moonPct = sForecastMoonPct(day);
    const spreadNote = dayIsAstroLed
      ? (day.astroConfidenceStdDev != null ? ` · spread ${day.astroConfidenceStdDev}` : '')
      : (day.confidenceStdDev != null ? ` · spread ${day.confidenceStdDev}` : '');
    const bestAltHour = day.bestAlt?.isAstroWin ? day.bestAlt.bestAstroHour : day.bestAlt?.bestDayHour;
    const altLine = day.bestAlt
      ? `Backup: ${day.bestAlt.name} · ${day.bestAlt.bestScore}/100${bestAltHour ? ` at ${bestAltHour}` : ''}${day.bestAlt.isAstroWin ? ' (astro)' : ''}${typeof day.bestAlt.driveMins === 'number' ? ` · ${day.bestAlt.driveMins} min drive` : ''}`
      : '';

    return sCard(`
      <div class="forecast-day-heading">${esc(dayHeading(day))} &middot; ${scoreState(displayScore).label} (${displayScore}/100)</div>
      <div class="forecast-best-line">${esc(forecastBestLine(day))}</div>
      <div class="chip-row">
        ${sChip('AM',    day.amScore    ?? 0, scoreState(day.amScore    ?? 0).fg)}
        ${sChip('PM',    day.pmScore    ?? 0, scoreState(day.pmScore    ?? 0).fg)}
        ${sChip('Astro', day.astroScore ?? 0, scoreState(day.astroScore ?? 0).fg)}
        ${confState ? `<span style="font-size:11px;font-weight:600;color:${confState.fg};">${esc(confState.label)}${esc(spreadNote)}</span>` : ''}
      </div>
      ${moonPct !== null ? `<p class="card-body" style="margin-top:8px;color:${C.secondary};">${moonIconForPct(moonPct, 12)} <span style="vertical-align:middle;">Moon ${moonPct}% lit</span></p>` : ''}
      ${altLine ? `<p class="card-body" style="margin-top:8px;">${esc(altLine)}</p>` : ''}
    `);
  }).join('')}</div>`;
}

// ── Spur of the moment ────────────────────────────────────────────────────────

function sSpurCard(spur: SpurOfTheMomentSuggestion): string {
  const regionLabel = spur.region.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const tagChips = spur.tags.slice(0, 3).map(tag => sChip(displayTag(tag), '')).join('');
  const darkSkyNote = spur.darkSky
    ? `<span style="font-size:12px;color:${C.secondary};">&#x2605; Dark sky site</span>`
    : '';
  return sCard(`
    <div style="font-size:14px;font-weight:600;color:var(--c-ink);margin-bottom:6px;">${esc(spur.locationName)}</div>
    <p class="card-body" style="margin-bottom:10px;">${esc(regionLabel)} &middot; ${spur.driveMins} min drive</p>
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:var(--c-ink);font-style:italic;">${esc(spur.hookLine)}</p>
    ${tagChips || darkSkyNote ? `<div class="chip-row" style="margin-top:10px;">${tagChips}${darkSkyNote}</div>` : ''}
  `, { accentSide: 'left', accentColor: C.brand });
}

// ── Hero card ─────────────────────────────────────────────────────────────────

function sHeroCard(
  heroScore: number,
  gradeLabel: string,
  locationName: string,
  topWindow: Window | null,
  allPast: boolean,
  today: string,
  factStats: SummaryStat[],
  scoreStats: SummaryStat[],
  moonPct: number,
  localSummary: string,
  alternativeSummary: string,
  altSummaryTitle: string,
): string {
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
    <div class="moon-context">${moonAstroContext(moonPct)}</div>
    ${sStatGrid(scoreStats, 'dark')}
    ${localSummary || alternativeSummary ? '<hr class="hero-divider" style="margin:12px 0 8px;">' : ''}
    ${localSummary ? `<div style="font-size:12px;line-height:1.55;color:rgba(255,255,255,0.60);">${esc(localSummary.replace(/\n/g, ' · '))}</div>` : ''}
    ${alternativeSummary ? `<div style="font-size:11px;line-height:1.5;color:rgba(255,255,255,0.38);margin-top:5px;">${esc(altSummaryTitle)}: ${esc(alternativeSummary)}</div>` : ''}
  </div>`;
}

// ── Footer key ────────────────────────────────────────────────────────────────

function sFooterKey(): string {
  return `<div class="footer-key">
    <strong>Key</strong> &middot;
    <strong>Score bands:</strong>
    Excellent &ge; ${SCORE_THRESHOLDS.excellent} &middot;
    Good ${SCORE_THRESHOLDS.good}&ndash;${SCORE_THRESHOLDS.excellent - 1} &middot;
    Marginal ${SCORE_THRESHOLDS.marginal}&ndash;${SCORE_THRESHOLDS.good - 1} &middot;
    Poor &lt; ${SCORE_THRESHOLDS.marginal} &middot;
    AM/PM = sunrise &amp; sunset light quality &middot;
    Astro = night sky potential (clear skies + dark moon) &middot;
    Outdoor comfort = walk/run practicality, independent of photography scoring &middot;
    Certainty: High &lt; 12 pts &middot; Fair 12&ndash;24 pts &middot; Low &ge; 25 pts
  </div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function formatSite(input: FormatEmailInput): string {
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
  const topAlternativeIsCloseContender = !topPrimaryAlternative && !!topCloseContender
    && topAlternative?.name === topCloseContender.name;

  const factStats: SummaryStat[] = [
    { label: 'Sunrise', value: sunriseStr, tone: C.primary },
    { label: 'Sunset',  value: sunsetStr,  tone: C.primary },
    { label: 'Moon',    value: `${moonDescriptor(moonPct)} · ${moonPct}% lit`, tone: C.tertiary },
    ...(todayConfidence ? [{
      label: 'Certainty',
      value: todayEffStdDev != null
        ? `${todayConfidence.label} · spread ${todayEffStdDev} pts`
        : todayConfidence.label,
      tone: todayConfidence.fg,
    }] : []),
  ];

  const scoreStats: SummaryStat[] = [
    { label: 'AM light',   value: `${todayDay.amScore   ?? 0}/100`, tone: scoreState(todayDay.amScore   ?? 0).fg },
    { label: 'PM light',   value: `${todayDay.pmScore   ?? 0}/100`, tone: scoreState(todayDay.pmScore   ?? 0).fg },
    { label: 'Peak astro', value: `${todayDay.astroScore ?? 0}/100`, tone: scoreState(todayDay.astroScore ?? 0).fg },
    { label: bestTimeLabel(topWindow, displayPlan.promotedFromPast), value: peakLocalHour || 'No clear slot', tone: C.onPrimaryContainer },
  ];

  const localSummary = effectiveDontBother
    ? (hasLocalWindow
        ? 'Not a great photography day locally — better to enjoy the outdoors instead.'
        : `No local window cleared the threshold today — treat ${locationName} as a pass unless you just want a walk.`)
    : timeAwareLocalSummary(displayPlan, topWindow, localSummaryLines(displayPlan, topWindow, todayDay));

  const spurMatchesTopAlt = !!spurOfTheMoment && !!topAlternative
    && spurOfTheMoment.locationName === topAlternative.name;
  const altSpurHook = spurMatchesTopAlt ? `\n"${spurOfTheMoment!.hookLine}"` : '';
  const altTimingNote = !topAlternative ? ''
    : topAlternative.isAstroWin
      ? ` · astro from ${topAlternative.bestAstroHour || 'evening'}`
      : ` · ${bestDaySessionLabel(topAlternative.bestDayHour).toLowerCase()} around ${topAlternative.bestDayHour || 'time TBD'}`;
  const altSummaryTitle = !topAlternative
    ? 'Best nearby alternative'
    : topAlternativeIsCloseContender
      ? 'Nearby darker-sky contender'
      : topAlternative.isAstroWin
        ? 'Best nearby astro alternative'
        : 'Best nearby golden-hour alternative';
  const alternativeSummary = topAlternative
    ? `${topAlternative.name} · ${topAlternative.bestScore}/100 · ${topAlternative.driveMins} min drive${altTimingNote}${altSpurHook}`
    : '';

  // Kit advisory
  const kitTips = buildKitTips(todayCarWashData, windows, todayDay.astroScore ?? 0, moonPct, 3, runTime.nowMinutes);

  // Hourly outlook
  const tomorrow = dailySummary.find(d => d.dayIdx === 1);
  const remainingPhotoWindows = displayPlan.remaining.filter(window => window !== topWindow);
  const startAtMinutes = runTime.nowMinutes % 60 === 0
    ? runTime.nowMinutes
    : runTime.nowMinutes + (60 - (runTime.nowMinutes % 60));

  const todayOutlookHtml = sHourlyOutlookSection(todayDay, {
    title: `Today from ${minutesToClock(startAtMinutes)}`,
    caption: "Today's remaining-hours outdoor outlook",
    summaryContext: 'today',
    startAtMinutes,
    showOvernight: false,
    photoWindows: [topWindow, ...remainingPhotoWindows].filter((window): window is Window => Boolean(window)),
  });
  const tomorrowOutlookHtml = !todayOutlookHtml
    ? sHourlyOutlookSection(tomorrow, {
        title: 'Tomorrow at a glance',
        caption: "Tomorrow's hourly weather outlook",
        summaryContext: 'tomorrow',
        startAtMinutes: null,
        showOvernight: false,
      })
    : '';
  const outlookHtml = todayOutlookHtml || tomorrowOutlookHtml;
  const outlookSectionTitle = todayOutlookHtml ? 'Remaining today' : "Tomorrow's weather";

  // Assemble page
  const sections: string[] = [];

  sections.push(sHeroCard(
    heroScore,
    todayScoreState.label,
    locationName,
    topWindow,
    displayPlan.allPast,
    today,
    factStats,
    scoreStats,
    moonPct,
    localSummary,
    alternativeSummary,
    altSummaryTitle,
  ));

  const utilityBar = sDaylightUtilityBar(todayCarWashData, runTime);
  if (utilityBar) sections.push(utilityBar);

  const signals = sSignalCards(shSunriseQ, shSunsetQ, shSunsetText, sunDir, crepPeak, metarNote, peakKpTonight, auroraSignal, locationName, homeLatitude);
  if (signals) sections.push(signals);

  if (!effectiveDontBother) {
    sections.push(`<div class="section-group">
      ${sSection("Today's window")}
      ${sWindowSection(effectiveDontBother, todayBestScore, aiText, windows, dailySummary, altLocations, runTime, peakKpTonight, compositionBullets, homeLatitude, locationName)}
    </div>`);
  }

  if (geminiInspire) sections.push(sCreativeSpark(geminiInspire));

  const kitCard = sKitAdvisoryCard(kitTips);
  if (kitCard) sections.push(kitCard);

  if (altLocations?.length || closeContenders?.length || longRangeTop) {
    const longRangeHtml = sLongRangeSection(longRangeTop, longRangeCardLabel, darkSkyAlert, runTime);
    sections.push(`<div class="section-group">
      ${sSection('Out of town options')}
      ${sAlternativeSection(altLocations, closeContenders, noAltsMsg)}
      ${longRangeHtml}
    </div>`);
  }

  if (outlookHtml) {
    sections.push(`<div class="section-group">
      ${sSection(outlookSectionTitle)}
      ${outlookHtml}
    </div>`);
  }

  const weekInsightCard = weekInsight
    ? sCard(`<p class="card-body">${esc(weekInsight)}</p>`, { accentSide: 'left', accentColor: C.tertiary })
    : '';
  sections.push(`<div class="section-group">
    ${sSection('Days ahead')}
    ${weekInsightCard}
    ${sPhotoForecastCards(dailySummary)}
  </div>`);

  if (spurOfTheMoment && !spurMatchesTopAlt) {
    sections.push(`<div class="section-group">
      ${sSection('Spur of the moment')}
      ${sSpurCard(spurOfTheMoment)}
    </div>`);
  }

  const pageContent = `<main>\n${sections.join('\n')}\n</main>\n${sFooterKey()}`;

  return renderSiteDocument(pageContent, {
    title: `Aperture — ${today}`,
    generatedAt: today,
  });
}
