/**
 * Editorial Candidate Selection
 *
 * Logic for building and selecting AI provider candidates.
 * Handles the primary/secondary provider choice algorithm.
 */

import type { EditorialProvider } from '../../../app/run-photo-brief/contracts.js';
import type { DebugGeminiDiagnostics } from '../../../lib/debug-context.js';
import { filterCompositionBullets } from './composition.js';
import { normalizeAiText, parseEditorialResponse } from './parse.js';
import type {
  BriefContext,
  EditorialCandidate,
  EditorialGatewayPayload,
  EditorialGatewayResult,
} from './types.js';
import { getEditorialCheck, getFactualCheck } from './validation.js';

function getGeminiDiagnostics(
  response: EditorialGatewayResult,
): DebugGeminiDiagnostics | undefined {
  return response.provider === 'gemini' ? response.diagnostics : undefined;
}

/**
 * Build an editorial candidate from raw provider response.
 *
 * @param provider - The AI provider (groq or gemini)
 * @param rawContent - Raw response content from the provider
 * @param ctx - Brief context for validation
 * @returns Editorial candidate or null if no content
 */
export function buildEditorialCandidate(
  response: EditorialGatewayResult,
  ctx: BriefContext,
): EditorialCandidate | null {
  if (response.outcome === 'empty' || !response.normalizedText.trim()) return null;

  const parsed = response.parsedResponse ?? parseEditorialResponse(response.rawText);
  const normalizedAiText = normalizeAiText(response.normalizedText);
  const factualCheck = getFactualCheck(normalizedAiText, ctx);
  const editorialCheck = getEditorialCheck(normalizedAiText, ctx);

  return {
    provider: response.provider,
    rawContent: response.rawText,
    editorial: parsed.editorial,
    compositionBullets: parsed.compositionBullets,
    weekInsight: parsed.weekInsight,
    spurRaw: parsed.spurRaw,
    parseResult: parsed.parseResult,
    weekStandoutRawValue: parsed.weekStandoutRawValue,
    normalizedAiText,
    factualCheck,
    editorialCheck,
    passed: factualCheck.passed && editorialCheck.passed,
    reusableComponents: response.outcome !== 'malformed',
  };
}

/**
 * Result of candidate selection.
 */
export interface CandidateSelectionResult {
  primaryProvider: EditorialProvider;
  selectedProvider: EditorialProvider | 'template';
  primaryCandidate: EditorialCandidate | null;
  secondaryCandidate: EditorialCandidate | null;
  selectedCandidate: EditorialCandidate | null;
  componentCandidate: EditorialCandidate | null;
  fallbackUsed: boolean;
}

/**
 * Choose the best editorial candidate from provider responses.
 *
 * Algorithm:
 * 1. Build candidates from both providers
 * 2. Prefer primary provider if it passes validation
 * 3. Fall back to secondary provider if primary fails
 * 4. Mark fallback if neither passes
 * 5. Identify component candidate for reusable parts
 *
 * @param preferredProvider - Preferred AI provider
 * @param ctx - Brief context for candidate building
 * @param groqRawContent - Raw Groq response
 * @param geminiRawContent - Raw Gemini response
 * @returns Selection result with chosen candidate
 */
export function chooseEditorialCandidate(
  preferredProvider: EditorialProvider,
  ctx: BriefContext,
  editorialGateway: EditorialGatewayPayload,
): CandidateSelectionResult {
  // Build candidates from both vendor gateway slots
  const groqCandidate = buildEditorialCandidate(editorialGateway.groq, ctx);
  const geminiCandidate = buildEditorialCandidate(editorialGateway.gemini, ctx);

  // Map slot role to vendor gateway: primary/fallback is a configured preference.
  // The n8n adapter passes preferredProvider as 'groq'|'gemini' but resolveEditorial
  // receives it as 'primary'|'fallback'. For the gateway lookup we rely on the
  // gateway having fixed groq/gemini keys. We choose primary = first configured slot.
  // By convention from finalize-brief: 'primary' slot = preferred adaptor var → groq or gemini.
  // Since EditorialProvider is now 'primary'|'fallback', we default primaries as:
  //   'primary' → groq (the default in n8n config)
  //   'fallback' → gemini
  // But the real mapping is controlled by FinalizeConfig.preferredProvider which is
  // passed through as a slot role. The CandidateSelectionResult.primaryProvider is the
  // slot role ('primary'|'fallback'). We track vendor names on the candidates themselves.
  const primaryVendorCandidate = preferredProvider === 'primary' ? groqCandidate : geminiCandidate;
  const secondaryVendorCandidate = preferredProvider === 'primary' ? geminiCandidate : groqCandidate;

  const primaryCandidate = primaryVendorCandidate;
  const secondaryCandidate = secondaryVendorCandidate;

  // Select candidate: prefer primary if it passes, else secondary, else null
  const selectedCandidate = primaryCandidate?.passed
    ? primaryCandidate
    : secondaryCandidate?.passed
      ? secondaryCandidate
      : null;

  // Component candidate can be selected or any with reusable components
  const componentCandidate = selectedCandidate
    || (primaryCandidate?.reusableComponents
      ? primaryCandidate
      : secondaryCandidate?.reusableComponents
        ? secondaryCandidate
        : null);

  // Determine selectedProvider slot role — must check for null first to avoid
  // null === null being mistakenly true (both selectedCandidate and primaryCandidate could be null)
  const selectedProviderSlot: EditorialProvider | 'template' =
    selectedCandidate === null
      ? 'template'
      : selectedCandidate === primaryCandidate
        ? preferredProvider
        : (preferredProvider === 'primary' ? 'fallback' : 'primary');

  return {
    primaryProvider: preferredProvider,
    selectedProvider: selectedProviderSlot,
    primaryCandidate,
    secondaryCandidate,
    selectedCandidate,
    componentCandidate,
    fallbackUsed: selectedCandidate === null,
  };
}

/**
 * Summarize why a candidate was rejected.
 *
 * @param provider - The provider that was rejected
 * @param rawContent - Raw response content
 * @param candidate - The candidate (may be null if parsing failed)
 * @param geminiDiagnostics - Optional Gemini diagnostics
 * @returns Rejection reason string or null
 */
export function summarizeCandidateRejection(
  response: EditorialGatewayResult,
  candidate: EditorialCandidate | null,
): string | null {
  const reasons: string[] = [];
  const rawContent = response.rawText;
  const provider = response.provider;
  const geminiDiagnostics = getGeminiDiagnostics(response);

  // Empty response
  if (!rawContent.trim()) {
    if (provider === 'gemini') {
      const statusCode = geminiDiagnostics?.statusCode;
      const responseByteLength = geminiDiagnostics?.responseByteLength;
      const extractionPath = geminiDiagnostics?.extractionPath;

      if (typeof responseByteLength === 'number' && responseByteLength > 0) {
        const statusLabel = statusCode !== null && statusCode !== undefined ? `HTTP ${statusCode}` : 'Gemini response';
        const extractionLabel = extractionPath ? ` (${extractionPath})` : '';
        reasons.push(`${statusLabel} — response received (${responseByteLength} bytes) but no Gemini text was extracted${extractionLabel}`);
      } else if (statusCode !== null && statusCode !== undefined) {
        reasons.push(`HTTP ${statusCode} but empty response body`);
      } else {
        reasons.push('empty response body');
      }
    } else {
      reasons.push('empty response body');
    }
  } else if (response.outcome === 'malformed' || (candidate && candidate.editorial === rawContent)) {
    // Raw content wasn't parsed properly
    if (provider === 'gemini' && geminiDiagnostics?.statusCode !== null && geminiDiagnostics?.statusCode !== undefined) {
      reasons.push(`HTTP ${geminiDiagnostics.statusCode} — response received (${geminiDiagnostics.responseByteLength ?? '?'} bytes) but editorial field absent or unparseable`);
    } else {
      reasons.push('editorial field absent or unparseable in response JSON');
    }
  }

  // Truncated response
  if (provider === 'gemini' && geminiDiagnostics?.truncated) {
    reasons.push(`response truncated (${geminiDiagnostics.finishReason || 'incomplete Gemini response'})`);
  }

  // Validation failures
  if (candidate && !candidate.factualCheck.passed) {
    reasons.push(`factual validation failed: ${candidate.factualCheck.rulesTriggered.join(', ')}`);
  }

  if (candidate && !candidate.editorialCheck.passed) {
    reasons.push(`editorial validation failed: ${candidate.editorialCheck.rulesTriggered.join(', ')}`);
  }

  return reasons.length ? reasons.join('; ') : null;
}

// Re-exports for consumers
export { filterCompositionBullets };
