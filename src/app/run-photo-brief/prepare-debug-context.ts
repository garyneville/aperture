/**
 * Prepare Debug Context
 *
 * Prepares the initial debug context before editorial resolution.
 */

import { emptyDebugContext } from '../../lib/debug-context.js';
import type { DebugContext } from '../../contracts/index.js';
import type {
  FinalizeConfig,
  FinalizeRuntimeContext,
  PreparedDebugContext,
} from './finalize-brief-contracts.js';

/**
 * Prepare the debug context from input and config.
 *
 * This creates the initial debug context before editorial resolution.
 */
export function prepareDebugContext(
  input: { context: FinalizeRuntimeContext },
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
