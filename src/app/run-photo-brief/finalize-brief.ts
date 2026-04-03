/**
 * Finalize Brief Use Case
 *
 * Assembles the final photo brief by orchestrating:
 * 1. Input normalization (parsing AI provider responses)
 * 2. Debug context preparation
 * 3. Editorial resolution (with validation and fallbacks)
 * 4. Debug trace hydration
 * 5. Rendering all output formats
 *
 * This is the core use case that the n8n adapter (and future CLI/HTTP adapters)
 * will call. It contains all the orchestration logic that was previously
 * spread across the adapter layer.
 */

import { resolveEditorial } from '../../domain/editorial/resolution/resolve-editorial.js';
import { emptyDebugContext } from '../../lib/debug-context.js';
import { upsertDebugPayloadSnapshot, serializeDebugPayload } from '../../lib/debug-payload.js';
import { formatSite } from '../../presenters/site/format-site.js';
import { formatTelegram } from '../../presenters/telegram/format-telegram.js';
import { formatDebugEmail, formatEmail } from '../../presenters/email/index.js';
import { renderBriefAsJson } from '../../presenters/brief-json/render-brief-json.js';
import { toScoredForecastContext } from './mappers/to-scored-forecast.js';
import type { EditorialDecision } from './contracts.js';
import type {
  FinalizeConfig,
  FinalizedBrief,
  NormalizedEditorialInput,
  PreparedDebugContext,
  RawEditorialInput,
} from './finalize-brief-contracts.js';

// Cross-layer types imported from contracts (shared across app/domain/presenters/adapters)
import type {
  BriefContext,
  DebugContext,
  DebugGeminiDiagnostics,
  DebugPayloadSnapshot,
  LongRangeSpurCandidate,
} from '../../contracts/index.js';

// Re-export contracts for consumers
export type {
  FinalizeConfig,
  FinalizedBrief,
  NormalizedEditorialInput,
  RawEditorialInput,
} from './finalize-brief-contracts.js';

/**
 * Normalize raw editorial inputs from AI providers.
 *
 * Parses Groq and Gemini responses, extracts diagnostics,
 * and prepares the context for editorial resolution.
 */
function normalizeEditorialInput(
  input: RawEditorialInput,
): NormalizedEditorialInput {
  const {
    context,
    groqChoices,
    geminiResponse,
    geminiRawPayload,
    geminiInspire,
    geminiDiagnostics: providedGeminiDiagnostics,
    nearbyAltNames,
    longRangePool,
  } = input;

  // Extract raw content from Groq response
  const groqRawContent = groqChoices?.[0]?.message?.content?.trim() || '';

  // Extract raw content from Gemini response
  const geminiRawContent = typeof geminiResponse === 'string'
    ? geminiResponse.trim()
    : '';

  // Normalize Gemini raw payload
  const normalizedGeminiRawPayload =
    typeof geminiRawPayload === 'string' && geminiRawPayload.trim().length > 0
      ? geminiRawPayload
      : undefined;

  // Build nearby alternative names list
  const normalizedNearbyAltNames = nearbyAltNames ?? [
    ...(context.altLocations || [])
      .map((alt: { name?: string }) => alt?.name)
      .filter((name: string | undefined): name is string => Boolean(name)),
    ...((context.debugContext?.nearbyAlternatives || [])
      .map((alt: { name?: string }) => alt?.name)
      .filter((name: string | undefined): name is string => Boolean(name))),
  ];

  // Determine long-range pool
  const normalizedLongRangePool = longRangePool ??
    (Array.isArray(context.longRangeDebugCandidates)
      ? context.longRangeDebugCandidates
      : Array.isArray(context.longRangeCandidates)
        ? context.longRangeCandidates
        : []);

  return {
    context,
    groqRawContent,
    geminiRawContent,
    geminiInspire: typeof geminiInspire === 'string' ? geminiInspire : undefined,
    geminiRawPayload: normalizedGeminiRawPayload,
    geminiDiagnostics: providedGeminiDiagnostics,
    nearbyAltNames: normalizedNearbyAltNames,
    longRangePool: normalizedLongRangePool,
  };
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : undefined;
}

/**
 * Extract Gemini diagnostics from raw input fields.
 *
 * This handles the case where diagnostics are provided as loose
 * fields rather than a structured object.
 */
export function extractGeminiDiagnostics(input: {
  geminiStatusCode?: unknown;
  geminiFinishReason?: unknown;
  geminiCandidateCount?: unknown;
  geminiResponseByteLength?: unknown;
  geminiResponseTruncated?: unknown;
  geminiExtractionPath?: unknown;
  geminiTopLevelKeys?: unknown;
  geminiPayloadKeys?: unknown;
  geminiPartKinds?: unknown;
  geminiExtractedTextLength?: unknown;
  geminiPromptTokenCount?: unknown;
  geminiCandidatesTokenCount?: unknown;
  geminiTotalTokenCount?: unknown;
  geminiThoughtsTokenCount?: unknown;
}): DebugGeminiDiagnostics | undefined {
  const {
    geminiStatusCode,
    geminiFinishReason,
    geminiCandidateCount,
    geminiResponseByteLength,
    geminiResponseTruncated,
    geminiExtractionPath,
    geminiTopLevelKeys,
    geminiPayloadKeys,
    geminiPartKinds,
    geminiExtractedTextLength,
    geminiPromptTokenCount,
    geminiCandidatesTokenCount,
    geminiTotalTokenCount,
    geminiThoughtsTokenCount,
  } = input;

  const hasAnyDiagnostic =
    typeof geminiStatusCode === 'number' ||
    (typeof geminiFinishReason === 'string' && geminiFinishReason.trim().length > 0) ||
    typeof geminiCandidateCount === 'number' ||
    typeof geminiResponseByteLength === 'number' ||
    typeof geminiResponseTruncated === 'boolean';

  if (!hasAnyDiagnostic) {
    return undefined;
  }

  return {
    statusCode: finiteNumberOrNull(geminiStatusCode),
    finishReason:
      typeof geminiFinishReason === 'string' && geminiFinishReason.trim().length > 0
        ? geminiFinishReason.trim()
        : null,
    candidateCount: finiteNumberOrNull(geminiCandidateCount),
    responseByteLength: finiteNumberOrNull(geminiResponseByteLength),
    truncated: geminiResponseTruncated === true,
    extractionPath:
      typeof geminiExtractionPath === 'string' && geminiExtractionPath.trim().length > 0
        ? geminiExtractionPath.trim()
        : null,
    topLevelKeys: stringList(geminiTopLevelKeys),
    payloadKeys: stringList(geminiPayloadKeys),
    partKinds: stringList(geminiPartKinds),
    extractedTextLength: finiteNumberOrNull(geminiExtractedTextLength),
    promptTokenCount: finiteNumberOrNull(geminiPromptTokenCount),
    candidatesTokenCount: finiteNumberOrNull(geminiCandidatesTokenCount),
    totalTokenCount: finiteNumberOrNull(geminiTotalTokenCount),
    thoughtsTokenCount: finiteNumberOrNull(geminiThoughtsTokenCount),
  };
}

/**
 * Prepare the debug context from input and config.
 *
 * This creates the initial debug context before editorial resolution.
 */
function prepareDebugContext(
  input: RawEditorialInput,
  config: FinalizeConfig,
): PreparedDebugContext {
  const ctx = input.context;

  const debugContext: DebugContext = {
    ...emptyDebugContext(),
    ...(ctx.debugContext && typeof ctx.debugContext === 'object'
      ? ctx.debugContext
      : {}),
  } as DebugContext;

  const debugMode = config.debug.enabled;
  const debugEmailTo = config.debug.emailTo;
  const debugModeSource =
    config.debug.source.trim().length > 0
      ? config.debug.source
      : debugMode
        ? 'toggle'
        : 'default';

  const triggerSource =
    config.triggerSource && config.triggerSource.trim().length > 0
      ? config.triggerSource.trim()
      : debugContext.metadata?.triggerSource || null;

  return {
    debugContext,
    debugMode,
    debugEmailTo,
    debugModeSource,
    triggerSource,
  };
}

/**
 * Normalize a long-range candidate for debug context.
 */
type LongRangeCandidateLike = {
  name?: string;
  region?: string;
  tags?: string[];
  bestScore?: number;
  dayScore?: number;
  astroScore?: number;
  driveMins?: number;
  darkSky?: boolean;
  deltaVsHome?: number;
  shown?: boolean;
  discardedReason?: string;
};

function normalizeLongRangeCandidate(
  candidate: LongRangeCandidateLike,
  rank: number,
) {
  return {
    name: typeof candidate.name === 'string' ? candidate.name : '(unknown)',
    region: typeof candidate.region === 'string' ? candidate.region : '—',
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    bestScore: typeof candidate.bestScore === 'number' ? candidate.bestScore : 0,
    dayScore: typeof candidate.dayScore === 'number' ? candidate.dayScore : 0,
    astroScore: typeof candidate.astroScore === 'number' ? candidate.astroScore : 0,
    driveMins: typeof candidate.driveMins === 'number' ? candidate.driveMins : 0,
    darkSky: candidate.darkSky === true,
    rank,
    deltaVsHome:
      typeof candidate.deltaVsHome === 'number' ? candidate.deltaVsHome : 0,
    shown: candidate.shown === true,
    discardedReason:
      typeof candidate.discardedReason === 'string'
        ? candidate.discardedReason
        : undefined,
  };
}

/**
 * Hydrate the debug context with editorial resolution results.
 *
 * This adds the AI trace, runtime payload snapshot, and metadata
 * to the debug context after editorial resolution completes.
 */
function hydrateDebugContext(
  prepared: PreparedDebugContext,
  options: {
    editorial: EditorialDecision;
    debugAiTrace: DebugContext['ai'];
    runtimePayloadSnapshot: Omit<DebugPayloadSnapshot, 'label'>;
    longRangePool: LongRangeSpurCandidate[];
    location: string;
    latitude: number;
    longitude: number;
    timezone: string;
  },
): DebugContext {
  const {
    editorial,
    debugAiTrace,
    runtimePayloadSnapshot,
    longRangePool,
    location,
    latitude,
    longitude,
    timezone,
  } = options;
  const { debugContext, debugMode, debugEmailTo, debugModeSource, triggerSource } =
    prepared;

  // Update metadata
  debugContext.metadata = {
    ...(debugContext.metadata || {}),
    generatedAt: debugContext.metadata?.generatedAt || new Date().toISOString(),
    location: debugContext.metadata?.location || location,
    latitude: debugContext.metadata?.latitude ?? latitude,
    longitude: debugContext.metadata?.longitude ?? longitude,
    timezone: debugContext.metadata?.timezone || timezone,
    workflowVersion: debugContext.metadata?.workflowVersion || null,
    triggerSource,
    debugModeEnabled: debugMode,
    debugModeSource,
    debugRecipient: debugMode ? debugEmailTo : null,
  };

  // Add long-range candidates
  if (Array.isArray(longRangePool)) {
    debugContext.longRangeCandidates = longRangePool.map((candidate, index) =>
      normalizeLongRangeCandidate(candidate, index + 1),
    );
  }

  // Add AI trace
  debugContext.ai = debugAiTrace;

  // Add runtime payload snapshot
  upsertDebugPayloadSnapshot(debugContext, {
    label: 'Final merged runtime payload',
    ...runtimePayloadSnapshot,
  });

  return debugContext;
}

/**
 * Render all output formats from the finalized brief data.
 */
function renderAllOutputs(
  context: BriefContext,
  editorial: EditorialDecision,
  debugContext: DebugContext,
  debugMode: boolean,
): {
  briefJson: ReturnType<typeof renderBriefAsJson>;
  telegramMsg: string;
  emailHtml: string;
  siteHtml: string;
  debugEmailHtml: string;
  debugEmailSubject: string;
} {
  // Map context to scored forecast context for rendering
  const scoredContext = toScoredForecastContext({
    ...context,
    debugContext,
  });

  // Render brief JSON (canonical output)
  const briefJson = renderBriefAsJson(scoredContext, editorial);

  // Render all presentation formats
  const telegramMsg = formatTelegram(briefJson);
  const emailHtml = formatEmail(briefJson);
  const siteHtml = formatSite(briefJson);

  // Render debug email if enabled
  const debugEmailHtml = debugMode ? formatDebugEmail(debugContext) : '';
  const today = (context as unknown as { today?: string }).today;
  const debugEmailSubject = debugContext.metadata?.location
    ? `Photo Brief Debug - ${debugContext.metadata.location} - ${today || 'today'}`
    : `Photo Brief Debug - ${today || 'today'}`;

  return {
    briefJson,
    telegramMsg,
    emailHtml,
    siteHtml,
    debugEmailHtml,
    debugEmailSubject,
  };
}

/**
 * Finalize the photo brief.
 *
 * This is the main use case that orchestrates the final assembly of the brief:
 * normalizing inputs, resolving editorial, hydrating debug context, and
 * rendering all output formats.
 *
 * @param input - Raw editorial inputs from AI providers
 * @param config - Configuration for the finalization
 * @returns The finalized brief with all outputs
 */
export function finalizeBrief(
  input: RawEditorialInput,
  config: FinalizeConfig,
): FinalizedBrief {
  // Step 1: Normalize editorial inputs
  const normalized = normalizeEditorialInput(input);

  // Step 2: Prepare debug context
  const preparedDebug = prepareDebugContext(input, config);

  // Step 3: Serialize runtime payload for debug
  const runtimePayloadSnapshot = serializeDebugPayload(input);

  // Step 4: Resolve editorial (with validation and fallbacks)
  const { editorial, debugAiTrace } = resolveEditorial({
    preferredProvider: config.preferredProvider,
    ctx: {
      ...normalized.context,
      debugContext: preparedDebug.debugContext,
      homeLatitude: config.homeLocation.lat,
      homeLocationName: config.homeLocation.name,
    },
    groqRawContent: normalized.groqRawContent,
    geminiRawContent: normalized.geminiRawContent,
    geminiInspire: normalized.geminiInspire,
    geminiDiagnostics: normalized.geminiDiagnostics,
    geminiRawPayload: normalized.geminiRawPayload,
    nearbyAltNames: normalized.nearbyAltNames,
    longRangePool: normalized.longRangePool,
  });

  // Step 5: Hydrate debug context with resolution results
  const debugContext = hydrateDebugContext(preparedDebug, {
    editorial,
    debugAiTrace,
    runtimePayloadSnapshot,
    longRangePool: normalized.longRangePool,
    location: config.homeLocation.name,
    latitude: config.homeLocation.lat,
    longitude: config.homeLocation.lon,
    timezone: config.homeLocation.timezone,
  });

  // Step 6: Render all outputs
  const rendered = renderAllOutputs(
    normalized.context,
    editorial,
    debugContext,
    preparedDebug.debugMode,
  );

  // Return the complete finalized brief
  return {
    ...rendered,
    editorial,
    debugMode: preparedDebug.debugMode,
    debugEmailTo: preparedDebug.debugEmailTo,
    debugContext,
  };
}
