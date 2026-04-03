import { esc } from '../../lib/utils.js';
import { renderMainEmailDocument } from './email-layout.js';
import {
  C,
  FONT,
  card,
  creativeSpark,
  sectionTitle,
  spacer,
} from './shared.js';
import { todayWindowSection } from './time-aware.js';
import {
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
  SpurOfTheMomentSuggestion,
} from './types.js';
import { signalCards } from './sections/signals.js';
import { alternativeSection, spurOfTheMomentCard } from './sections/alternatives.js';
import { longRangeSection } from './sections/long-range.js';
import { sessionRecommendationCard } from './sections/session-recommendation.js';
import { footerKey } from './sections/footer.js';
import { heroSection } from './sections/hero.js';
import { buildSharedPresentationContext } from '../shared/presenter-context.js';

export { formatDebugEmail } from './debug-email.js';
export { buildKitTips, evaluateKitRules, type KitTip } from './kit-advisory.js';
export { windowCard, compositionCard, poorDayFallbackLine } from './window-cards.js';
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
    topWindowIsAstro,
    todayEffConf,
    todayEffStdDev,
    topAlternative,
    topAlternativeIsCloseContender,
    localSummary,
    kitTips,
    tomorrow,
    photoWindowsForTodayOutlook,
  } = buildSharedPresentationContext(input);

  const hero = heroSection({
    heroScore,
    today,
    locationName,
    todayScoreState,
    topWindow,
    effectiveDontBother,
    displayPlan,
    todayDay,
    moonPct,
    sunriseStr,
    sunsetStr,
    todayEffConf,
    todayEffStdDev,
    peakLocalHour,
    topWindowIsAstro,
    topAlternative,
    topAlternativeIsCloseContender,
    localSummary,
    spurOfTheMoment,
  });

  const signals = signalCards(shSunriseQ, shSunsetQ, shSunsetText, sunDir, crepPeak, metarNote, peakKpTonight, auroraSignal, locationName, homeLatitude);
  const kitCard = kitAdvisoryCard(kitTips);

  if (debugContext) {
    const { trace, tipsShown } = evaluateKitRules(todayCarWashData, windows, todayDay.astroScore ?? 0, moonPct, 3, runTime.nowMinutes);
    debugContext.kitAdvisory = { rules: trace, tipsShown };
  }

  const todayOutlookHtml = remainingTodayHourlyOutlookSection(
    todayDay,
    runTime,
    photoWindowsForTodayOutlook,
    debugContext,
  );
  const tomorrowOutlookHtml = todayOutlookHtml
    ? ''
    : nextDayHourlyOutlookSection(tomorrow, debugContext);
  const outlookHtml = todayOutlookHtml || tomorrowOutlookHtml;
  const outlookSectionTitle = todayOutlookHtml ? 'Remaining today' : 'Tomorrow\'s weather';
  const longRangeHtml = longRangeSection(longRangeTop, longRangeCardLabel, darkSkyAlert, runTime);
  const sessionCard = sessionRecommendationCard(sessionRecommendation);
  const spurMatchesTopAlt = !!spurOfTheMoment && !!topAlternative && spurOfTheMoment.locationName === topAlternative.name;

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

  sections.push(spacer(16), `<tr><td>${footerKey()}</td></tr>`);
  return renderMainEmailDocument(sections.join(''));
}
