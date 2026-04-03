/**
 * Window scheduling and display policy module.
 *
 * This module provides pure functions for:
 * - Time conversion (clock strings ↔ minutes)
 * - Window classification (past/current/future)
 * - Display planning (primary/remaining/past windows)
 * - Fallback text generation
 *
 * Used by both domain logic (editorial resolution, validation) and presenters
 * to ensure consistent window handling across the application.
 */

export { clockToMinutes, minutesToClock } from './time.js';
export {
  buildWindowDisplayPlan,
  classifyWindowTiming,
  getRunTimeContext,
  windowRange,
} from './policy.js';
export { timeAwareBriefingFallback } from './fallback.js';
