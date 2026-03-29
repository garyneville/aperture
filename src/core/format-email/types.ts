// Compatibility shim: the canonical brief render contracts now live in
// src/types/brief.ts so non-email renderers can depend on them directly.
export type {
  AltLocation,
  CarWash,
  DarkSkyAlertCard,
  DaySummary,
  LongRangeCard,
  NextDayHour,
  RunTimeContext,
  SpurOfTheMomentSuggestion,
  Window,
  WindowDisplayPlan,
  WindowHour,
} from '../../types/brief.js';

export type { BriefRenderInput as FormatEmailInput } from '../../types/brief.js';
