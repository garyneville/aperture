/**
 * Shared presenter context builder.
 *
 * Computes the common derived state used by both the email and site
 * presenters so they can focus on markup/layout instead of re-running the
 * same branching and selection logic independently.
 */

import { buildWindowDisplayPlan, getRunTimeContext } from '../../domain/windowing/index.js';
import { resolveHomeLatitude, resolveHomeLocationName } from '../../lib/home-location.js';
import type {
  AltLocation,
  BriefRenderInput,
  DaySummary,
  RunTimeContext,
  Window,
  WindowDisplayPlan,
} from '../../contracts/index.js';
import { buildKitTips, type KitTip } from './kit-advisory.js';
import { confidenceDetail, effectiveConf, scoreState } from './brief-primitives.js';
import {
  displaySessionName,
  isAstroWindow,
  localSummaryLines,
  peakHourForWindow,
  timeAwareLocalSummary,
} from './window-helpers.js';

export interface SharedPresentationContext {
  homeLatitude: number;
  locationName: string;
  todayDay: DaySummary;
  runTime: RunTimeContext;
  displayPlan: WindowDisplayPlan;
  effectiveDontBother: boolean;
  topWindow: Window | null;
  heroScore: number;
  peakLocalHour: string | null;
  todayScoreState: ReturnType<typeof scoreState>;
  topWindowIsAstro: boolean;
  todayEffConf: string | undefined;
  todayEffStdDev: number | null | undefined;
  todayConfidence: ReturnType<typeof confidenceDetail>;
  topAlternative: AltLocation | null;
  topAlternativeIsCloseContender: boolean;
  localSummary: string;
  kitTips: KitTip[];
  tomorrow: DaySummary | undefined;
  photoWindowsForTodayOutlook: Window[];
  startAtMinutes: number;
}

export function buildSharedPresentationContext(
  input: BriefRenderInput,
): SharedPresentationContext {
  const homeLatitude = resolveHomeLatitude({
    location: input.location,
    debugContext: input.debugContext,
  });
  const locationName = resolveHomeLocationName({
    location: input.location,
    debugContext: input.debugContext,
  });

  const todayDay = input.dailySummary[0] || ({} as DaySummary);
  const runTime = getRunTimeContext(input.debugContext);
  const hasLocalWindow = input.windows.length > 0;
  const effectiveDontBother = input.dontBother || !hasLocalWindow;
  const displayPlan = buildWindowDisplayPlan(input.windows, runTime.nowMinutes);
  const topWindow = !effectiveDontBother ? displayPlan.primary : null;
  const heroScore = todayDay.headlineScore ?? input.todayBestScore;
  const peakLocalHour = effectiveDontBother
    ? null
    : peakHourForWindow(topWindow || undefined) || todayDay.bestPhotoHour || null;
  const todayScoreState = scoreState(heroScore);
  const topWindowIsAstro = isAstroWindow(topWindow || undefined);
  const { confidence: todayEffConf, stdDev: todayEffStdDev } = effectiveConf(
    todayDay,
    topWindowIsAstro,
  );
  const todayConfidence = confidenceDetail(todayEffConf);

  const topPrimaryAlternative = input.altLocations?.[0] || null;
  const topCloseContender = input.closeContenders?.[0] || null;
  const topAlternative = topPrimaryAlternative || topCloseContender || todayDay.bestAlt || null;
  const topAlternativeIsCloseContender =
    !topPrimaryAlternative &&
    !!topCloseContender &&
    topAlternative?.name === topCloseContender.name;

  const localSummary = effectiveDontBother
    ? (hasLocalWindow
        ? (input.sessionRecommendation?.primary
            ? `Overall conditions stay marginal, but ${displaySessionName(input.sessionRecommendation.primary.session).toLowerCase()} is the strongest specialist opportunity if you want to be selective.`
            : 'Not a great photography day locally — better to enjoy the outdoors instead.')
        : `No local window cleared the threshold today — treat ${locationName} as a pass unless you just want a walk.`)
    : timeAwareLocalSummary(displayPlan, topWindow, localSummaryLines(displayPlan, topWindow, todayDay));

  const kitTips = buildKitTips(
    input.todayCarWash,
    input.windows,
    todayDay.astroScore ?? 0,
    input.moonPct,
    3,
    runTime.nowMinutes,
  );

  const tomorrow = input.dailySummary.find(day => day.dayIdx === 1);
  const remainingPhotoWindows = displayPlan.remaining.filter(window => window !== topWindow);
  const photoWindowsForTodayOutlook = [topWindow, ...remainingPhotoWindows]
    .filter((window): window is Window => Boolean(window));
  const startAtMinutes = runTime.nowMinutes % 60 === 0
    ? runTime.nowMinutes
    : runTime.nowMinutes + (60 - (runTime.nowMinutes % 60));

  return {
    homeLatitude,
    locationName,
    todayDay,
    runTime,
    displayPlan,
    effectiveDontBother,
    topWindow,
    heroScore,
    peakLocalHour,
    todayScoreState,
    topWindowIsAstro,
    todayEffConf,
    todayEffStdDev,
    todayConfidence,
    topAlternative,
    topAlternativeIsCloseContender,
    localSummary,
    kitTips,
    tomorrow,
    photoWindowsForTodayOutlook,
    startAtMinutes,
  };
}
