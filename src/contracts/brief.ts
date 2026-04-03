/**
 * Public contract surface for brief-related types.
 *
 * This module exports types shared across app, domain, presenters, and adapters.
 * Import from here rather than from internal implementation paths.
 */

export {
  BRIEF_JSON_SCHEMA_VERSION,
} from '../types/brief.js';

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
} from '../types/brief.js';
