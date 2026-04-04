/**
 * Public contract surface for debug context types.
 *
 * This module exports types shared across app, domain, presenters, and adapters
 * for debug tracing and diagnostics. Import from here rather than from internal
 * implementation paths.
 *
 * Note: Debug types now use slot role naming (primary/fallback) rather than
 * provider-specific naming (gemini/groq) to reflect the architectural separation
 * between transport concerns and business logic.
 */

export type {
  DebugContext,
  // New slot-role based diagnostics
  DebugPrimaryDiagnostics,
  DebugFallbackDiagnostics,
  // Legacy diagnostics (deprecated, use slot-role versions)
  DebugGeminiDiagnostics,
  DebugGroqDiagnostics,
  DebugApiCallStatus,
  DebugPayloadSnapshot,
  DebugRunMetadata,
  DebugScores,
  DebugHourlyScore,
  DebugHourlySessionScore,
  DebugWindowTrace,
  DebugNearbyAlternative,
  DebugAiCheck,
  DebugWeekStandoutTrace,
  DebugAiTrace,
  DebugLongRangeCandidate,
  DebugKitAdvisory,
  DebugKitAdvisoryRule,
  DebugOutdoorComfort,
  DebugOutdoorComfortHour,
  WeekStandoutDecision,
  // Provider slot types
  ProviderSlot,
  SelectedProvider,
} from '../lib/debug-context.js';
