/**
 * Public contract surface for cross-layer types.
 *
 * This module is the single entry point for types shared across app, domain,
 * presenters, and adapters. Import from here rather than from internal paths.
 *
 * @example
 * ```typescript
 * import type { BriefJson, ScoredForecastContext, EditorialDecision } from '../contracts/index.js';
 * ```
 */

// Brief types (payloads, render inputs, window definitions)
export {
  BRIEF_JSON_SCHEMA_VERSION,
} from './brief.js';

export type {
  AltLocation,
  BriefJson,
  BriefRenderInput,
  CarWash,
  DarkSkyAlertCard,
  DaySummary,
  LongRangeCard,
  NextDayHour,
  SpurOfTheMomentSuggestion,
  Window,
  WindowDisplayPlan,
  WindowHour,
} from './brief.js';

// Scored forecast context (runtime context for rendering)
export type { ScoredForecastContext } from './scored-forecast.js';

// Session scoring types
export type {
  SessionConfidence,
  SessionEvaluator,
  SessionId,
  SessionRecommendationSummary,
  SessionScore,
} from './session-score.js';

// Editorial resolution types
export type {
  BriefContext,
  LongRangeSpurCandidate,
  ResolveEditorialInput,
  ResolveEditorialOutput,
  SpurSuggestion,
} from './editorial.js';

// Run photo brief use case types
export type {
  EditorialDecision,
} from './run-photo-brief.js';
