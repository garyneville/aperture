import type { Window, DailySummary, CarWash } from '../../windowing/best-windows.js';
import { auroraVisibleKpThresholdForLat, isAuroraLikelyVisibleAtLat } from '../aurora-visibility.js';
import { emptyDebugContext, type DebugContext } from '../../../lib/debug-context.js';
import type { DarkSkyAlert, LongRangeCandidate, LongRangeDebugCandidate } from '../../scoring/score-long-range.js';
import type { AuroraSignal } from '../../../lib/aurora-providers.js';
import {
  DEFAULT_BRIEF_WORKFLOW_VERSION,
  DEFAULT_HOME_LOCATION,
  type HomeLocation,
} from '../../../types/home-location.js';
import type { ScoredForecastContext } from '../../../types/scored-forecast.js';
import type { SessionRecommendationSummary } from '../../../types/session-score.js';
import { getSeasonalNote } from './sections/seasonal-context.js';
import { peakKpForNight, buildAuroraNote } from './sections/aurora-note.js';
import {
  extractLocalHHMM,
  isAstroWindow,
  weekSummaryLine,
  moonTimingNote,
  confidenceLabel,
  getMonthOneIndexed,
} from './sections/shared.js';
import { buildDontBotherPrompt } from './sections/dont-bother-prompt.js';
import { buildLocalWindowPrompt } from './sections/local-window-prompt.js';

export interface KpEntry {
  time: string;
  kp: number;
}

export interface BuildPromptInput {
  homeLocation?: HomeLocation;
  workflowVersion?: string;
  windows: Window[];
  dontBother: boolean;
  todayBestScore: number;
  todayCarWash: CarWash;
  dailySummary: DailySummary[];
  altLocations?: AltLocationResult[];
  closeContenders?: AltLocationResult[];
  noAltsMsg?: string | null;
  metarNote: string;
  sessionRecommendation?: SessionRecommendationSummary;
  sunrise?: string;
  sunset?: string;
  moonPct: number;
  kpForecast?: KpEntry[];
  auroraSignal?: AuroraSignal | null;
  now?: Date;
  debugContext?: DebugContext;
  longRangeTop?: LongRangeCandidate | null;
  longRangeCardLabel?: string | null;
  darkSkyAlert?: DarkSkyAlert | null;
  longRangeCandidates?: LongRangeCandidate[];
  longRangeDebugCandidates?: LongRangeDebugCandidate[];
}

export interface AltLocationResult {
  name: string;
  driveMins: number;
  bestScore: number;
  bestDayHour: string | null;
  bestAstroHour: string | null;
  isAstroWin: boolean;
  darkSky: boolean;
  types: string[];
}

export interface BuildPromptOutput extends ScoredForecastContext {
  prompt: string;
}

export function buildPrompt(input: BuildPromptInput): BuildPromptOutput {
  const {
    homeLocation = DEFAULT_HOME_LOCATION,
    workflowVersion = DEFAULT_BRIEF_WORKFLOW_VERSION,
    windows, dontBother, todayBestScore, todayCarWash,
    dailySummary, altLocations, closeContenders, noAltsMsg, metarNote,
    sessionRecommendation,
    sunrise, sunset, moonPct, kpForecast, auroraSignal,
    longRangeTop, longRangeCardLabel, darkSkyAlert,
    longRangeCandidates, longRangeDebugCandidates,
  } = input;

  const now = input.now || new Date();
  const debugContext = input.debugContext || emptyDebugContext();
  const homeLocationName = homeLocation.name;

  const sunriseStr = sunrise ? extractLocalHHMM(sunrise) : '--:--';
  const sunsetStr = sunset ? extractLocalHHMM(sunset) : '--:--';
  const today = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: homeLocation.timezone,
  });

  const currentMonth = getMonthOneIndexed(now, homeLocation.timezone);
  const seasonalNote = getSeasonalNote(currentMonth);
  const peakKpTonight = peakKpForNight(kpForecast, now);
  const auroraNote = buildAuroraNote(peakKpTonight, homeLocation, auroraSignal);
  const auroraThreshold = auroraVisibleKpThresholdForLat(homeLocation.lat);
  const auroraVisibleLocally = isAuroraLikelyVisibleAtLat(homeLocation.lat, peakKpTonight);
  const weekLine = weekSummaryLine(dailySummary);

  const todayDay = dailySummary[0];
  const hasLocalWindow = windows.length > 0;
  const effectiveDontBother = dontBother || !hasLocalWindow;

  debugContext.metadata = {
    generatedAt: now.toISOString(),
    location: homeLocation.name,
    latitude: homeLocation.lat,
    longitude: homeLocation.lon,
    timezone: homeLocation.timezone,
    workflowVersion,
    debugModeEnabled: false,
    debugModeSource: null,
    debugRecipient: null,
  };

  const selectedWindowIsAstro = isAstroWindow(windows[0]);
  let confNote = '';
  if (selectedWindowIsAstro) {
    const ac = todayDay?.astroConfidence;
    if (ac && ac !== 'unknown') {
      confNote = `\nForecast certainty (astro window): ${confidenceLabel(ac)}.` +
        (todayDay?.astroConfidenceStdDev !== null && todayDay?.astroConfidenceStdDev !== undefined
          ? ` Night-hour models differ by about ${todayDay.astroConfidenceStdDev} cloud-cover points.`
          : '');
    }
  } else if (todayDay?.confidence && todayDay.confidence !== 'unknown') {
    confNote = `\nForecast certainty: ${confidenceLabel(todayDay.confidence)}.` +
      (todayDay.confidenceStdDev !== null && todayDay.confidenceStdDev !== undefined
        ? ` Forecast models differ by about ${todayDay.confidenceStdDev} cloud-cover points during the key shooting hours.`
        : '');
  }

  const shInfo = todayDay
    ? `SunsetHue golden-hour quality — sunrise: ${todayDay.shSunriseQuality ?? 'N/A'}% | sunset: ${todayDay.shSunsetQuality ?? 'N/A'}% (${todayDay.shSunsetText || 'N/A'})\n` +
      (todayDay.sunDirection !== null ? `Sun direction at golden hour: ${Math.round(todayDay.sunDirection!)}°\n` : '') +
      (todayDay.crepRayPeak > 0 ? `Crepuscular ray potential: ${todayDay.crepRayPeak}/100` : '')
    : '';
  const moonNote = moonTimingNote(todayDay);

  let prompt: string;

  if (effectiveDontBother) {
    prompt = buildDontBotherPrompt({
      homeLocationName,
      todayBestScore,
      seasonalNote,
      auroraNote,
      shInfo,
      moonNote,
      confNote,
      altLocations,
      weekLine,
      todayDay,
      hasLocalWindow,
    });
  } else {
    const nowTimeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: homeLocation.timezone });
    const nowMinutes = (() => {
      const [h, m] = nowTimeStr.split(':').map(Number);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
    })();

    prompt = buildLocalWindowPrompt({
      homeLocationName,
      windows,
      nowTimeStr,
      nowMinutes,
      today,
      sunriseStr,
      sunsetStr,
      moonPct,
      seasonalNote,
      auroraNote,
      shInfo,
      moonNote,
      confNote,
      metarNote,
      weekLine,
      altLocations,
      todayDay,
      auroraVisibleLocally,
      auroraThreshold,
      peakKpTonight,
      currentMonth,
      sessionRecommendation,
    });
  }

  return {
    prompt,
    dontBother: effectiveDontBother,
    windows,
    todayCarWash,
    dailySummary,
    altLocations,
    closeContenders,
    noAltsMsg,
    sunriseStr,
    sunsetStr,
    moonPct,
    metarNote,
    sessionRecommendation,
    today,
    todayBestScore,
    shSunsetQ: todayDay?.shSunsetQuality ?? null,
    shSunriseQ: todayDay?.shSunriseQuality ?? null,
    shSunsetText: todayDay?.shSunsetText ?? null,
    sunDir: todayDay?.sunDirection ?? null,
    crepPeak: todayDay?.crepRayPeak || 0,
    peakKpTonight,
    auroraSignal: auroraSignal ?? null,
    debugContext,
    longRangeTop,
    longRangeCardLabel,
    darkSkyAlert,
    longRangeCandidates,
    longRangeDebugCandidates,
  };
}
