/**
 * Public contract surface for debug context types.
 *
 * This module exports types shared across app, domain, presenters, and adapters
 * for debug tracing and diagnostics. Import from here rather than from internal
 * implementation paths.
 */

export type {
  DebugContext,
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
  WeekStandoutParseStatus,
  WeekStandoutDecision,
} from '../lib/debug-context.js';
