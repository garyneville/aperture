/**
 * Mapper from finalize runtime context to ScoredForecastContext.
 *
 * This module provides an explicit, type-safe mapping from the loose
 * finalize-brief runtime payload shape to the strict internal
 * ScoredForecastContext shape.
 */

import type {
  ScoredForecastContext,
  AltLocation,
  LongRangeCard,
  DarkSkyAlertCard,
  SessionRecommendationSummary,
} from '../../../contracts/index.js';
import type { FinalizeRuntimeContext } from '../finalize-brief-contracts.js';
import type { AuroraSignal } from '../../../lib/aurora-providers.js';

/**
 * Safely extract typed array from runtime context.
 */
function safeArray<T>(value: unknown): T[] | undefined {
  if (Array.isArray(value)) return value as T[];
  return undefined;
}

/**
 * Safely extract string from runtime context.
 */
function safeString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  return undefined;
}

/**
 * Safely extract number from runtime context.
 */
function safeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  return undefined;
}

/**
 * Safely extract boolean from runtime context.
 */
function safeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  return undefined;
}

/**
 * Map FinalizeRuntimeContext to ScoredForecastContext.
 *
 * This function explicitly extracts and validates fields from the loose
 * n8n runtime payload, creating a strict ScoredForecastContext for use
 * by presenters and domain logic.
 *
 * @param ctx - The finalize-brief runtime context
 * @returns A strictly typed ScoredForecastContext
 */
export function toScoredForecastContext(
  ctx: FinalizeRuntimeContext & { debugContext: ScoredForecastContext['debugContext'] },
): ScoredForecastContext {
  // Extract altLocations with runtime validation
  const altLocations = safeArray<AltLocation>(ctx.altLocations);

  // Extract closeContenders with runtime validation
  const closeContenders = safeArray<AltLocation>(ctx.closeContenders);

  // Extract session recommendation
  const sessionRecommendation = ctx.sessionRecommendation as SessionRecommendationSummary | undefined;

  // Extract long range candidates
  const longRangeCandidates = safeArray<LongRangeCard>(ctx.longRangeCandidates);

  // Extract aurora signal
  const auroraSignal = ctx.auroraSignal as AuroraSignal | undefined;

  // Extract dark sky alert
  const darkSkyAlert = ctx.darkSkyAlert as DarkSkyAlertCard | undefined;

  // Extract windows array
  const windows = safeArray<ScoredForecastContext['windows'] extends (infer T)[] ? T : never>(ctx.windows) || [];

  // Extract daily summary array
  const dailySummary = safeArray<ScoredForecastContext['dailySummary'] extends (infer T)[] ? T : never>(ctx.dailySummary) || [];

  // Build the strict context
  return {
    // Required fields with safe extraction
    windows,
    dailySummary,
    dontBother: safeBoolean(ctx.dontBother) ?? false,
    todayCarWash: ctx.todayCarWash as ScoredForecastContext['todayCarWash'],
    sunriseStr: safeString(ctx.sunriseStr) ?? '',
    sunsetStr: safeString(ctx.sunsetStr) ?? '',
    moonPct: safeNumber(ctx.moonPct) ?? 0,
    moonAltAtBestAstro: safeNumber(ctx.moonAltAtBestAstro) ?? null,
    metarNote: safeString(ctx.metarNote) ?? '',
    shSunsetText: safeString(ctx.shSunsetText) ?? null,
    today: safeString(ctx.today) ?? '',
    todayBestScore: safeNumber(ctx.todayBestScore) ?? 0,
    shSunsetQ: safeNumber(ctx.shSunsetQ) ?? null,
    shSunriseQ: safeNumber(ctx.shSunriseQ) ?? null,
    sunDir: safeNumber(ctx.sunDir) ?? null,
    crepPeak: safeNumber(ctx.crepPeak) ?? 0,
    peakKpTonight: safeNumber(ctx.peakKpTonight) ?? null,

    // Optional fields
    altLocations,
    closeContenders,
    noAltsMsg: safeString(ctx.noAltsMsg) ?? null,
    sessionRecommendation,
    longRangeTop: ctx.longRangeTop as ScoredForecastContext['longRangeTop'],
    longRangeCardLabel: safeString(ctx.longRangeCardLabel),
    longRangeCandidates,
    auroraSignal,
    darkSkyAlert,

    // Debug context is guaranteed by the caller at render time
    debugContext: ctx.debugContext,
  };
}
