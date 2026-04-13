import { renderSiteDocument } from './site-layout.js';
import {
  C,
  type SummaryStat,
  scoreState,
} from '../shared/brief-primitives.js';
import { minutesToClock } from '../../domain/windowing/index.js';
import {
  bestDaySessionLabel,
  bestTimeLabel,
  moonDescriptor,
} from '../shared/window-helpers.js';
import type { BriefRenderInput as FormatEmailInput } from '../../contracts/index.js';

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
import { buildSharedPresentationContext } from '../shared/presenter-context.js';

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
    moonAltAtBestAstro,
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
  const {
    homeLatitude,
    locationName,
    todayDay,
    runTime,
    effectiveDontBother,
    displayPlan,
    topWindow,
    heroScore,
    peakLocalHour,
    todayScoreState,
    todayEffStdDev,
    todayConfidence,
    topAlternative,
    topAlternativeIsCloseContender,
    localSummary,
    kitTips,
    tomorrow,
    photoWindowsForTodayOutlook,
    startAtMinutes,
  } = buildSharedPresentationContext(input);

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

  // Hourly outlook
  const todayOutlookHtml = sHourlyOutlookSection({
    day: todayDay,
    title: `Today from ${minutesToClock(startAtMinutes)}`,
    caption: "Today's remaining-hours outdoor outlook",
    summaryContext: 'today',
    startAtMinutes,
    showOvernight: false,
    photoWindows: photoWindowsForTodayOutlook,
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
    moonAltAtBestAstro,
    localSummary,
    alternativeSummary,
    altSummaryTitle,
    hasAstroWindow: windows.some(w => w.label?.toLowerCase().includes('astro') || (w.tops || []).includes('astrophotography')),
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
  const nextDayBridgeCard = input.nextDayBridge
    ? sCard(`<p class="card-body">\ud83d\udd2e ${input.nextDayBridge}</p>`, { accentSide: 'left', accentColor: C.secondary })
    : '';
  sections.push(`<div class="section-group">
    ${sSection('Days ahead')}
    ${weekInsightCard}
    ${nextDayBridgeCard}
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
