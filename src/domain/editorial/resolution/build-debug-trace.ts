/**
 * Build Debug AI Trace
 *
 * Constructs the debug trace object for editorial resolution.
 * Captures provider responses, validation results, and component resolution.
 */

import type {
  DebugAiTrace,
  DebugPrimaryDiagnostics,
  DebugFallbackDiagnostics,
} from '../../../lib/debug-context.js';
import type { EditorialProvider } from '../../../app/run-photo-brief/contracts.js';
import type {
  EditorialGatewayPayload,
  EditorialParseResult,
  WeekStandoutResolution,
} from './types.js';
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
function buildCompositionDebugInfo(input: CompositionDebugInput): { rawCount: number; resolvedCount: number; sourceProvider: string | null } {
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
  };
}

/**
 * Build week standout debug information.
 */
function buildWeekStandoutDebugInfo(
  parseResult: EditorialParseResult | undefined,
  rawValue: string | null | undefined,
  resolved: WeekStandoutResolution,
): DebugAiTrace['weekStandout'] {
  return {
    parseResult: parseResult ?? 'raw-text-only',
    rawValue: rawValue ?? null,
    used: resolved.used,
    decision: resolved.decision,
    finalValue: resolved.text ?? null,
    hintAligned: resolved.hintAligned,
    note: resolved.note ?? null,
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
  /** Provider gateway payload built at the runtime edge */
  editorialGateway: EditorialGatewayPayload;
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
  /** Best available hint candidate for debug derivation */
  weekStandoutHintCandidate: {
    parseResult?: EditorialParseResult;
    weekStandoutRawValue?: string | null;
  } | null;
}

/**
 * Build the complete debug AI trace.
 *
 * @param input - All data needed to construct the trace
 * @returns Complete debug AI trace object
 */
export function buildDebugAiTrace(input: BuildDebugTraceInput): DebugAiTrace {
  const primaryGateway = input.selection.primaryProvider === 'groq'
    ? input.editorialGateway.groq
    : input.editorialGateway.gemini;
  const fallbackGateway = input.selection.primaryProvider === 'groq'
    ? input.editorialGateway.gemini
    : input.editorialGateway.groq;

  const primaryDiagnostics = primaryGateway.diagnostics as DebugPrimaryDiagnostics | undefined;
  const fallbackDiagnostics = fallbackGateway.diagnostics as DebugFallbackDiagnostics | undefined;
  const apiCallStatuses = [
    input.editorialGateway.groq.apiCallStatus,
    input.editorialGateway.gemini.apiCallStatus,
  ].filter((status): status is NonNullable<typeof status> => Boolean(status));

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
    input.weekStandoutHintCandidate?.parseResult,
    input.weekStandoutHintCandidate?.weekStandoutRawValue ?? null,
    input.weekStandout,
  );

  // Calculate model fallback (different provider used but not template)
  const modelFallbackUsed = !input.selection.fallbackUsed
    && input.selection.selectedProvider !== input.selection.primaryProvider
    && input.selection.selectedProvider !== 'template';

  // Raw responses mapped to slot roles
  const rawFallbackResponse = fallbackGateway.rawText;
  const rawPrimaryResponse = primaryGateway.rawText;
  const rawPrimaryPayload = 'rawPayload' in primaryGateway
    ? primaryGateway.rawPayload
    : undefined;

  return {
    // Slot role based fields (new)
    primaryProvider: input.selection.primaryProvider,
    selectedProvider: input.selection.selectedProvider,
    primaryRejectionReason: input.primaryRejectionReason,
    secondaryRejectionReason: input.secondaryRejectionReason,
    rawFallbackResponse,
    rawPrimaryResponse,
    rawPrimaryPayload,
    primaryDiagnostics,
    fallbackDiagnostics,

    // Legacy field names (for backward compatibility)
    rawGroqResponse: input.editorialGateway.groq.rawText,
    rawGeminiResponse: input.editorialGateway.gemini.rawText,
    rawGeminiPayload: input.editorialGateway.gemini.rawPayload,
    geminiDiagnostics: input.editorialGateway.gemini.diagnostics,
    groqDiagnostics: input.editorialGateway.groq.diagnostics,

    apiCallStatuses: apiCallStatuses.length > 0 ? apiCallStatuses : undefined,
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
