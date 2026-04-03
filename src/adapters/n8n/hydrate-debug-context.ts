import {
  emptyDebugContext,
  type DebugAiTrace,
  type DebugContext,
  type DebugPayloadSnapshot,
} from '../../core/debug-context.js';
import { upsertDebugPayloadSnapshot } from '../../core/debug-payload.js';
import type {
  LongRangeCandidateLike,
} from './contracts/final-runtime-payload.js';

type PreparedDebugContext = {
  debugContext: DebugContext;
  debugMode: boolean;
  debugEmailTo: string;
  debugModeSource: string;
  triggerSource: string | null;
};

type DebugBoundaryPayload = {
  debugContext?: Partial<DebugContext> | Record<string, unknown>;
  debugMode?: unknown;
  debugEmailTo?: unknown;
  debugModeSource?: unknown;
  triggerSource?: unknown;
};

function normaliseLongRangeCandidate(candidate: LongRangeCandidateLike, rank: number) {
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
    deltaVsHome: typeof candidate.deltaVsHome === 'number' ? candidate.deltaVsHome : 0,
    shown: candidate.shown === true,
    discardedReason: typeof candidate.discardedReason === 'string' ? candidate.discardedReason : undefined,
  };
}

export function prepareDebugContext(ctx: DebugBoundaryPayload): PreparedDebugContext {
  const debugContext = {
    ...emptyDebugContext(),
    ...(ctx.debugContext && typeof ctx.debugContext === 'object' ? ctx.debugContext : {}),
  } as DebugContext;
  const debugMode = ctx.debugMode === true;
  const debugEmailTo = typeof ctx.debugEmailTo === 'string' ? ctx.debugEmailTo : '';
  const debugModeSource = typeof ctx.debugModeSource === 'string' && ctx.debugModeSource.trim().length > 0
    ? ctx.debugModeSource
    : (debugMode ? 'workflow toggle' : 'workflow default');
  const triggerSource = typeof ctx.triggerSource === 'string' && ctx.triggerSource.trim().length > 0
    ? ctx.triggerSource.trim()
    : debugContext.metadata?.triggerSource || null;

  return {
    debugContext,
    debugMode,
    debugEmailTo,
    debugModeSource,
    triggerSource,
  };
}

export function hydrateDebugContext(
  prepared: PreparedDebugContext,
  options: {
    debugAiTrace: DebugAiTrace;
    runtimePayloadSnapshot: Omit<DebugPayloadSnapshot, 'label'>;
    longRangePool: LongRangeCandidateLike[];
    location: string;
    latitude: number;
    longitude: number;
    timezone: string;
  },
): DebugContext {
  const {
    debugAiTrace,
    runtimePayloadSnapshot,
    longRangePool,
    location,
    latitude,
    longitude,
    timezone,
  } = options;
  const {
    debugContext,
    debugMode,
    debugEmailTo,
    debugModeSource,
    triggerSource,
  } = prepared;

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

  if (Array.isArray(longRangePool)) {
    debugContext.longRangeCandidates = longRangePool
      .map((candidate, index) => normaliseLongRangeCandidate(candidate, index + 1));
  }

  debugContext.ai = debugAiTrace;
  upsertDebugPayloadSnapshot(debugContext, {
    label: 'Final merged runtime payload',
    ...runtimePayloadSnapshot,
  });

  return debugContext;
}
