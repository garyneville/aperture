/**
 * Editorial Resolution
 *
 * Main orchestration for resolving editorial content from AI providers.
 * This is the thin orchestrator that coordinates:
 * - Candidate selection
 * - Fallback generation
 * - Component resolution
 * - Debug trace building
 *
 * Heavy logic has been extracted to focused modules.
 */

import {
  normalizeAiText,
  parseEditorialResponse,
} from './parse.js';
import type {
  BriefContext,
  LongRangeSpurCandidate,
  ResolveEditorialInput,
  ResolveEditorialOutput,
} from './types.js';

// Import from split modules
import {
  buildEditorialCandidate,
  chooseEditorialCandidate,
  summarizeCandidateRejection,
} from './candidate-selection.js';
import { buildFallbackAiText } from './fallbacks.js';
import { buildDebugAiTrace } from './build-debug-trace.js';
import { resolveEditorialComponents } from './resolve-components.js';

// Re-exports for consumers
export type {
  BriefContext,
  EditorialGatewayOutcome,
  EditorialGatewayParseState,
  EditorialGatewayPayload,
  EditorialGatewayResult,
  EditorialCandidatePayload,
  EditorialModelResponse,
  EditorialParseResult,
  // Slot role based types (preferred)
  PrimaryEditorialGatewayResult,
  FallbackEditorialGatewayResult,
  // Legacy provider-specific types (deprecated)
  GeminiEditorialGatewayResult,
  GroqEditorialGatewayResult,
  LongRangeSpurCandidate,
  ResolveEditorialInput,
  ResolveEditorialOutput,
  SpurRaw,
  WindowLike,
} from './types.js';
export {
  normalizeAiText,
  parseEditorialResponse,
} from './parse.js';
export {
  isFactuallyIncoherentEditorial,
  shouldReplaceAiText,
} from './validation.js';
export { filterCompositionBullets } from './composition.js';
export { resolveSpurSuggestion } from './spur-suggestion.js';
export {
  buildEditorialCandidate,
  chooseEditorialCandidate,
  summarizeCandidateRejection,
} from './candidate-selection.js';
export { buildFallbackAiText } from './fallbacks.js';
export { buildDebugAiTrace } from './build-debug-trace.js';
export { resolveEditorialComponents } from './resolve-components.js';

/**
 * Resolve editorial content from AI provider responses.
 *
 * This is the main orchestration function that:
 * 1. Selects the best candidate from provider responses
 * 2. Resolves spur-of-the-moment suggestions
 * 3. Validates and filters components (week insight, composition bullets)
 * 4. Generates fallback text if needed
 * 5. Builds comprehensive debug trace
 *
 * @param input - Editorial resolution input with provider responses and context
 * @returns Editorial decision and debug trace
 */
export function resolveEditorial(input: ResolveEditorialInput): ResolveEditorialOutput {
  const {
    preferredProvider,
    ctx,
    editorialGateway,
    geminiInspire,
    nearbyAltNames = [],
    longRangePool = [],
  } = input;
  const groqResponse = editorialGateway.groq;
  const geminiResponse = editorialGateway.gemini;

  // Step 1: Select best candidate from provider responses
  const selection = chooseEditorialCandidate(
    preferredProvider,
    ctx,
    editorialGateway,
  );

  // Determine secondary provider for rejection summarization
  const secondaryProvider = preferredProvider === 'groq' ? 'gemini' : 'groq';

  // Step 2: Extract component data
  const { selectedCandidate } = selection;

  // Step 3: Resolve reusable components from the best available candidate
  const resolvedComponents = resolveEditorialComponents({
    selection,
    ctx,
    nearbyAltNames,
    longRangePool,
  });

  // Step 4: Determine final AI text (selected candidate or fallback)
  const aiText = selectedCandidate
    ? selectedCandidate.normalizedAiText
    : buildFallbackAiText(ctx);

  // Step 5: Process Gemini inspire
  const safeGeminiInspire = typeof geminiInspire === 'string' && geminiInspire.trim().length > 0
    ? geminiInspire.trim()
    : undefined;

  // Step 6: Calculate rejection reasons
  const primaryResponse = editorialGateway[preferredProvider];
  const secondaryResponse = editorialGateway[secondaryProvider];

  const primaryRejectionReason = selection.selectedProvider === preferredProvider
    ? null
    : summarizeCandidateRejection(
        primaryResponse,
        selection.primaryCandidate,
      );

  const secondaryRejectionReason = selection.selectedProvider === secondaryProvider
    ? null
    : selection.selectedProvider === 'template'
      ? summarizeCandidateRejection(
          secondaryResponse,
          selection.secondaryCandidate,
        )
      : null;

  // Step 7: Build debug trace
  const debugAiTrace = buildDebugAiTrace({
    selection,
    finalAiText: aiText,
    editorialGateway,
    primaryRejectionReason,
    secondaryRejectionReason,
    bestSpurRaw: resolvedComponents.bestSpurRaw,
    spurOfTheMoment: resolvedComponents.spurOfTheMoment,
    spurDropReason: resolvedComponents.spurDropReason,
    rawCompositionCount: resolvedComponents.rawCompositionBullets.length,
    resolvedCompositionBullets: resolvedComponents.compositionBullets,
    weekStandout: resolvedComponents.weekStandout,
    weekStandoutHintCandidate: resolvedComponents.weekStandoutHintCandidate,
  });

  // Return final editorial decision
  return {
    editorial: {
      primaryProvider: selection.primaryProvider,
      selectedProvider: selection.selectedProvider,
      fallbackUsed: selection.fallbackUsed,
      aiText,
      compositionBullets: resolvedComponents.compositionBullets,
      weekInsight: resolvedComponents.weekStandout.text,
      spurOfTheMoment: resolvedComponents.spurOfTheMoment,
      geminiInspire: safeGeminiInspire,
      rawGroqResponse: groqResponse.rawText || undefined,
      rawGeminiResponse: geminiResponse.rawText || undefined,
      rawGeminiPayload: geminiResponse.rawPayload,
    },
    debugAiTrace,
  };
}
