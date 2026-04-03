/**
 * Outdoor Outlook Model (Email Compatibility Re-export)
 *
 * This module now re-exports from ../shared/outdoor-outlook-model.ts.
 * The implementation has been moved to the shared presenter layer
 * to enable use across multiple output channels (email, site, etc.).
 *
 * For new code, import directly from ../shared/outdoor-outlook-model.js
 * This file is kept for backwards compatibility with existing imports.
 *
 * @deprecated Import from ../shared/outdoor-outlook-model.js instead
 */

// Re-export all shared outdoor outlook model functionality
export {
  buildOutdoorOutlookModel,
  formatPhotoWindowList,
  type OutdoorOutlookRow,
  type OutdoorOutlookOptions,
  type OutdoorOutlookModel,
} from '../shared/outdoor-outlook-model.js';
