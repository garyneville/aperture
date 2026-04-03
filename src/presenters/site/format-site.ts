import { renderSiteDocument } from './site-layout.js';
import {
  C,
  type SummaryStat,
  confidenceDetail,
  effectiveConf,
  scoreState,
} from '../shared/brief-primitives.js';
import {
  bestDaySessionLabel,
  bestTimeLabel,
  buildWindowDisplayPlan,
  displaySessionName,
  getRunTimeContext,
  isAstroWindow,
  localSummaryLines,
  minutesToClock,
  moonDescriptor,
  peakHourForWindow,
  timeAwareLocalSummary,
} from '../email/time-aware.js';
import { buildKitTips } from '../email/kit-advisory.js';
import { resolveHomeLatitude, resolveHomeLocationName } from '../../types/home-location.js';
import type {
  BriefRenderInput as FormatEmailInput,
  DaySummary,
  Window,
} from '../../types/brief.js';

// Extracted sections
import { sHeroCard } from './sections/hero.js';
import { sSignalCards } from './sections/signals.js';
import { sWindowSection } from './sections/window.js';
import { sDaylightUtilityBar } from './sections/daylight-utility.js';
import { sSessionRecommendationCard } from './sections/session-rec.js';
import { sCreativeSpark } from './sections/creative-spark.js';
import { sKitAdvisoryCard } from './sections/kit-advisory.js';
import { sAlternativeSection } from './sections/alternatives.js';
import { sLongRangeSection } from './sections/long-range.js';
import { sHourlyOutlookSection } from './sections/hourly-outlook.js';
import { sPhotoForecastCards } from './sections/forecast.js';
import { sSpurCard } from './sections/spur-of-moment.js';
import { sFooterKey } from './sections/footer.js';
import { sSection, sCard } from './sections/shared.js';

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
        ? (sessionRecommendation?.primary
            ? `Overall conditions stay marginal, but ${displaySessionName(sessionRecommendation.primary.session).toLowerCase()} is the strongest specialist opportunity if you want to be selective.`
            : 'Not a great photography day locally — better to enjoy the outdoors instead.')
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

  const todayOutlookHtml = sHourlyOutlookSection({
    day: todayDay,
    title: `Today from ${minutesToClock(startAtMinutes)}`,
    caption: "Today's remaining-hours outdoor outlook",
    summaryContext: 'today',
    startAtMinutes,
    showOvernight: false,
    photoWindows: [topWindow, ...remainingPhotoWindows].filter((window): window is Window => Boolean(window)),
  });
  const tomorrowOutlookHtml = !todayOutlookHtml
    ? sHourlyOutlookSection({
        day: tomorrow,
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

  sections.push(sHeroCard({
    heroScore,
    gradeLabel: todayScoreState.label,
    locationName,
    topWindow,
    allPast: displayPlan.allPast,
    today,
    factStats,
    scoreStats,
    moonPct,
    localSummary,
    alternativeSummary,
    altSummaryTitle,
  }));

  const utilityBar = sDaylightUtilityBar({ todayCarWash: todayCarWashData, runTime });
  if (utilityBar) sections.push(utilityBar);

  const sessionCard = sSessionRecommendationCard({ sessionRecommendation });
  if (sessionCard) sections.push(sessionCard);

  const signals = sSignalCards({
    shSunriseQ,
    shSunsetQ,
    shSunsetText,
    sunDir,
    crepPeak,
    metarNote,
    peakKpTonight,
    auroraSignal,
    locationName,
    homeLatitude,
  });
  if (signals) sections.push(signals);

  if (!effectiveDontBother) {
    sections.push(`<div class="section-group">
      ${sSection("Today's window")}
      ${sWindowSection({
        dontBother: effectiveDontBother,
        todayBestScore,
        aiText,
        windows,
        dailySummary,
        altLocations,
        runTime,
        peakKpTonight,
        compositionBullets,
        homeLatitude,
        homeLocationName: locationName,
      })}
    </div>`);
  }

  if (geminiInspire) sections.push(sCreativeSpark({ text: geminiInspire }));

  const kitCard = sKitAdvisoryCard({ tips: kitTips });
  if (kitCard) sections.push(kitCard);

  if (altLocations?.length || closeContenders?.length || longRangeTop) {
    const longRangeHtml = sLongRangeSection({ longRangeTop, cardLabel: longRangeCardLabel, darkSkyAlert, runTime });
    sections.push(`<div class="section-group">
      ${sSection('Out of town options')}
      ${sAlternativeSection({ altLocations, closeContenders, noAltsMsg })}
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
    ? sCard(`<p class="card-body">${weekInsight}</p>`, { accentSide: 'left', accentColor: C.tertiary })
    : '';
  sections.push(`<div class="section-group">
    ${sSection('Days ahead')}
    ${weekInsightCard}
    ${sPhotoForecastCards(dailySummary)}
  </div>`);

  if (spurOfTheMoment && !spurMatchesTopAlt) {
    sections.push(`<div class="section-group">
      ${sSection('Spur of the moment')}
      ${sSpurCard({ spur: spurOfTheMoment })}
    </div>`);
  }

  const pageContent = `<main>\n${sections.join('\n')}\n</main>\n${sFooterKey()}`;

  return renderSiteDocument(pageContent, {
    title: `Aperture — ${today}`,
    generatedAt: today,
  });
}
