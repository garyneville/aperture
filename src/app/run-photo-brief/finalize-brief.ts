/**
 * Finalize Brief Use Case
 *
 * Assembles the final photo brief by orchestrating:
 * 1. Input normalization (defaulting gateway-side editorial inputs)
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
import { serializeDebugPayload } from '../../lib/debug-payload.js';
import { normalizeEditorialInput } from './normalize-editorial-input.js';
import { prepareDebugContext } from './prepare-debug-context.js';
import { hydrateDebugContext } from './hydrate-debug-context.js';
import { renderAllOutputs } from './render-outputs.js';
import type { EditorialDecision } from './contracts.js';
import type {
  FinalizeConfig,
  FinalizedBrief,
  RawEditorialInput,
} from './finalize-brief-contracts.js';

// Re-export contracts for consumers
export type {
  FinalizeConfig,
  FinalizedBrief,
  FinalizeRuntimeContext,
  NormalizedEditorialInput,
  RawEditorialInput,
} from './finalize-brief-contracts.js';

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
    editorialGateway: normalized.editorialGateway,
    geminiInspire: normalized.geminiInspire,
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
