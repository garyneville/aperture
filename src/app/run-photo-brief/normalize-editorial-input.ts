/**
 * Normalize Editorial Input
 *
 * Normalizes raw editorial inputs from AI providers into a canonical form
 * for the finalize-brief use case.
 */

import type {
  FinalizeRuntimeContext,
  NormalizedEditorialInput,
  RawEditorialInput,
} from './finalize-brief-contracts.js';
import type { LongRangeSpurCandidate } from '../../contracts/index.js';

/**
 * Normalize editorial inputs for the finalize-brief use case.
 *
 * Provider transport extraction already happened at the runtime edge.
 * The app layer only applies shared defaults here.
 */
export function normalizeEditorialInput(
  input: RawEditorialInput,
): NormalizedEditorialInput {
  const {
    context,
    editorialGateway,
    geminiInspire,
    nearbyAltNames,
    longRangePool,
  } = input;

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
    editorialGateway,
    geminiInspire: typeof geminiInspire === 'string' ? geminiInspire : undefined,
    nearbyAltNames: normalizedNearbyAltNames,
    longRangePool: normalizedLongRangePool as LongRangeSpurCandidate[],
  };
}
