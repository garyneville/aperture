/**
 * Public contract surface for session scoring types.
 *
 * This module exports types shared across app, domain, presenters, and adapters.
 * Import from here rather than from internal implementation paths.
 */

export type {
  SessionConfidence,
  SessionEvaluator,
  SessionId,
  SessionRecommendationSummary,
  SessionScore,
} from '../types/session-score.js';
