import type { EditorialDecision } from '../core/standalone/contracts.js';
import type { ScoredForecastContext } from '../types/scored-forecast.js';
import {
  BRIEF_JSON_SCHEMA_VERSION,
  type BriefJson,
} from '../types/brief.js';

export function renderBriefAsJson(
  scoredContext: ScoredForecastContext,
  editorial: EditorialDecision,
): BriefJson {
  const metadata = scoredContext.debugContext?.metadata;

  return {
    schemaVersion: BRIEF_JSON_SCHEMA_VERSION,
    generatedAt: metadata?.generatedAt || null,
    location: {
      name: metadata?.location || null,
      timezone: metadata?.timezone || null,
      latitude: metadata?.latitude ?? null,
      longitude: metadata?.longitude ?? null,
    },
    dontBother: scoredContext.dontBother,
    windows: scoredContext.windows,
    todayCarWash: scoredContext.todayCarWash,
    dailySummary: scoredContext.dailySummary,
    altLocations: scoredContext.altLocations || [],
    closeContenders: scoredContext.closeContenders,
    noAltsMsg: scoredContext.noAltsMsg ?? undefined,
    sunriseStr: scoredContext.sunriseStr,
    sunsetStr: scoredContext.sunsetStr,
    moonPct: scoredContext.moonPct,
    metarNote: scoredContext.metarNote,
    today: scoredContext.today,
    todayBestScore: scoredContext.todayBestScore,
    shSunsetQ: scoredContext.shSunsetQ,
    shSunriseQ: scoredContext.shSunriseQ,
    shSunsetText: scoredContext.shSunsetText ?? undefined,
    sunDir: scoredContext.sunDir,
    crepPeak: scoredContext.crepPeak,
    aiText: editorial.aiText,
    compositionBullets: editorial.compositionBullets,
    weekInsight: editorial.weekInsight,
    peakKpTonight: scoredContext.peakKpTonight,
    auroraSignal: scoredContext.auroraSignal,
    longRangeTop: scoredContext.longRangeTop,
    longRangeCardLabel: scoredContext.longRangeCardLabel,
    darkSkyAlert: scoredContext.darkSkyAlert,
    spurOfTheMoment: editorial.spurOfTheMoment ?? undefined,
    geminiInspire: editorial.geminiInspire,
    debugContext: scoredContext.debugContext,
  };
}
