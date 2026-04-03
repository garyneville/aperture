/**
 * Outdoor Comfort Scoring (Email Compatibility Re-export)
 *
 * This module now re-exports from ../shared/outdoor-comfort.ts.
 * The implementation has been moved to the shared presenter layer
 * to enable use across multiple output channels (email, site, etc.).
 *
 * For new code, import directly from ../shared/outdoor-comfort.js
 * This file is kept for backwards compatibility with existing imports.
 *
 * @deprecated Import from ../shared/outdoor-comfort.js instead
 */

// Re-export all shared outdoor comfort functionality
export {
  outdoorComfortScore,
  outdoorComfortLabel,
  outdoorComfortReason,
  outdoorComfortReasonCodes,
  COMFORT_SCORE_CONFIG,
  RUN_FRIENDLY_THRESHOLDS,
  COMFORT_REASON_THRESHOLDS,
  type ComfortLabel,
  type ComfortReasonCode,
} from '../shared/outdoor-comfort.js';
