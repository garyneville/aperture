/**
 * Build Debug AI Trace
 *
 * Constructs the debug trace object for editorial resolution.
 * Captures provider responses, validation results, and component resolution.
 */

import type { DebugAiTrace, DebugGeminiDiagnostics, DebugGroqDiagnostics } from '../../../lib/debug-context.js';
import type { EditorialProvider } from '../../../app/run-photo-brief/contracts.js';
import type { WeekStandoutResolution } from './types.js';
import type { CandidateSelectionResult } from './candidate-selection.js';

/**
 * Input for building spur suggestion debug info.
 */
interface SpurDebugInput {
  bestSpurRaw: { locationName: string; confidence: number } | null;
  spurOfTheMoment: { locationName?: string } | null;
  dropReason: string | null | undefined;
}

/**
 * Input for building composition bullets debug info.
 */
interface CompositionDebugInput {
  rawCount: number;
  resolvedCount: number;
  componentCandidate: { provider: EditorialProvider; compositionBullets?: string[] } | null;
  primaryCandidate: { provider: EditorialProvider; compositionBullets?: string[] } | null;
  secondaryCandidate: { provider: EditorialProvider; compositionBullets?: string[] } | null;
}

/**
 * Build spur suggestion debug information.
 */
function buildSpurDebugInfo(input: SpurDebugInput): DebugAiTrace['spurSuggestion'] {
  return {
    raw: input.bestSpurRaw
      ? `${input.bestSpurRaw.locationName} (${input.bestSpurRaw.confidence})`
      : null,
    confidence: input.bestSpurRaw?.confidence ?? null,
    resolved: input.spurOfTheMoment?.locationName ?? null,
    dropped: Boolean(input.bestSpurRaw) && !input.spurOfTheMoment,
    dropReason: input.dropReason ?? undefined,
  };
}

/**
 * Build composition bullets debug information.
 */
function buildCompositionDebugInfo(input: CompositionDebugInput): { rawCount: number; resolvedCount: number; sourceProvider: string | null; resolved: string[] } {
  const sourceProvider = input.rawCount > 0
    ? (input.componentCandidate?.compositionBullets?.length
        ? input.componentCandidate.provider
        : null)
      ?? (input.primaryCandidate?.compositionBullets?.length
          ? input.primaryCandidate.provider
          : null)
      ?? (input.secondaryCandidate?.compositionBullets?.length
          ? input.secondaryCandidate.provider
          : null)
    : null;

  return {
    rawCount: input.rawCount,
    resolvedCount: input.resolvedCount,
    sourceProvider: sourceProvider as string | null,
    resolved: [] as string[], // Will be filled by caller with actual bullets
  };
}

/**
 * Build week standout debug information.
 */
function buildWeekStandoutDebugInfo(
  parseStatus: string | undefined,
  rawValue: string | null | undefined,
  resolved: WeekStandoutResolution,
): DebugAiTrace['weekStandout'] {
  return {
    parseStatus: (parseStatus as DebugAiTrace['weekStandout']['parseStatus']) || 'absent',
    rawValue: rawValue ?? null,
    used: resolved.usedRaw,
    decision: resolved.decision,
    finalValue: resolved.text ?? null,
    fallbackReason: resolved.fallbackReason ?? null,
  };
}

/**
 * Input parameters for building the complete debug trace.
 */
export interface BuildDebugTraceInput {
  /** The candidate selection result */
  selection: CandidateSelectionResult;
  /** The final AI text used */
  finalAiText: string;
  /** Groq raw response content */
  groqRawContent: string;
  /** Gemini raw response content */
  geminiRawContent: string;
  /** Gemini raw payload for debugging */
  geminiRawPayload?: string;
  /** Gemini diagnostics */
  geminiDiagnostics?: DebugGeminiDiagnostics;
  /** Groq diagnostics */
  groqDiagnostics?: DebugGroqDiagnostics;
  /** Primary rejection reason or null */
  primaryRejectionReason: string | null;
  /** Secondary rejection reason or null */
  secondaryRejectionReason: string | null;
  /** Best spur-of-the-moment raw data */
  bestSpurRaw: { locationName: string; confidence: number } | null;
  /** Resolved spur suggestion */
  spurOfTheMoment: { locationName?: string } | null;
  /** Spur drop reason */
  spurDropReason?: string | null;
  /** Raw composition bullet count */
  rawCompositionCount: number;
  /** Resolved composition bullets */
  resolvedCompositionBullets: string[];
  /** Week standout resolution result */
  weekStandout: WeekStandoutResolution;
  /** Component candidate for parse status */
  componentCandidate: { weekStandoutParseStatus?: string; weekStandoutRawValue?: string | null } | null;
  /** API call statuses for both providers */
  apiCallStatuses?: DebugAiTrace['apiCallStatuses'];
}

/**
 * Build the complete debug AI trace.
 *
 * @param input - All data needed to construct the trace
 * @returns Complete debug AI trace object
 */
export function buildDebugAiTrace(input: BuildDebugTraceInput): DebugAiTrace {
  // Find the trace candidate (for validation results)
  const traceCandidate = input.selection.selectedCandidate
    || input.selection.componentCandidate
    || input.selection.primaryCandidate
    || input.selection.secondaryCandidate;

  // Build component parts
  const spurSuggestion = buildSpurDebugInfo({
    bestSpurRaw: input.bestSpurRaw,
    spurOfTheMoment: input.spurOfTheMoment,
    dropReason: input.spurDropReason,
  });

  const compositionDebugInfo = buildCompositionDebugInfo({
    rawCount: input.rawCompositionCount,
    resolvedCount: input.resolvedCompositionBullets.length,
    componentCandidate: input.selection.componentCandidate,
    primaryCandidate: input.selection.primaryCandidate,
    secondaryCandidate: input.selection.secondaryCandidate,
  });
  // Fill in resolved bullets
  const compositionBullets: DebugAiTrace['compositionBullets'] = {
    rawCount: compositionDebugInfo.rawCount,
    resolvedCount: compositionDebugInfo.resolvedCount,
    sourceProvider: compositionDebugInfo.sourceProvider,
    resolved: input.resolvedCompositionBullets,
  };

  const weekStandout = buildWeekStandoutDebugInfo(
    input.componentCandidate?.weekStandoutParseStatus,
    input.componentCandidate?.weekStandoutRawValue ?? null,
    input.weekStandout,
  );

  // Calculate model fallback (different provider used but not template)
  const modelFallbackUsed = !input.selection.fallbackUsed
    && input.selection.selectedProvider !== input.selection.primaryProvider
    && input.selection.selectedProvider !== 'template';

  return {
    primaryProvider: input.selection.primaryProvider,
    selectedProvider: input.selection.selectedProvider,
    primaryRejectionReason: input.primaryRejectionReason,
    secondaryRejectionReason: input.secondaryRejectionReason,
    rawGroqResponse: input.groqRawContent,
    rawGeminiResponse: input.geminiRawContent || undefined,
    rawGeminiPayload: input.geminiRawPayload,
    geminiDiagnostics: input.geminiDiagnostics,
    groqDiagnostics: input.groqDiagnostics,
    apiCallStatuses: input.apiCallStatuses,
    normalizedAiText: traceCandidate?.normalizedAiText || '',
    factualCheck: traceCandidate?.factualCheck || {
      passed: false,
      rulesTriggered: ['missing AI summary'],
    },
    editorialCheck: traceCandidate?.editorialCheck || {
      passed: false,
      rulesTriggered: ['missing AI summary'],
    },
    spurSuggestion,
    compositionBullets,
    weekStandout,
    fallbackUsed: input.selection.fallbackUsed,
    modelFallbackUsed,
    finalAiText: input.finalAiText,
  };
}
