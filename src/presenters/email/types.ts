// Compatibility shim: the canonical brief render contracts now live in
// src/contracts/ so presenter entrypoints can share the same public surface.
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
} from '../../contracts/index.js';

export type { BriefRenderInput as FormatEmailInput } from '../../contracts/index.js';
