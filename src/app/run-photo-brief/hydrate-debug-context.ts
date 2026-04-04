/**
 * Hydrate Debug Context
 *
 * Hydrates the debug context with editorial resolution results.
 */

import type {
  DebugContext,
  DebugPayloadSnapshot,
  LongRangeSpurCandidate,
} from '../../contracts/index.js';
import type { EditorialDecision } from './contracts.js';
import type { PreparedDebugContext } from './finalize-brief-contracts.js';
import { upsertDebugPayloadSnapshot } from '../../lib/debug-payload.js';

/**
 * Normalize a long-range candidate for debug context.
 */
interface LongRangeCandidateLike {
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
}

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
export function hydrateDebugContext(
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
      normalizeLongRangeCandidate(candidate as LongRangeCandidateLike, index + 1),
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
