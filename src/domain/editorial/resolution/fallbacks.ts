/**
 * Editorial Fallbacks
 *
 * Fallback text generation when AI providers fail or produce invalid output.
 * Provides time-aware and generic fallback options.
 */

import { buildFallbackAiText as buildSharedFallbackAiText } from '../ai-briefing.js';
import {
  buildWindowDisplayPlan,
  getRunTimeContext,
  timeAwareBriefingFallback,
} from '../../../domain/windowing/index.js';
import type { BriefContext } from './types.js';

/**
 * Configuration for fallback text generation.
 */
export interface FallbackConfig {
  /** Whether to attempt time-aware fallbacks */
  enableTimeAware: boolean;
  /** Minimum windows required for time-aware fallback */
  minWindows: number;
}

/**
 * Default fallback configuration.
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enableTimeAware: true,
  minWindows: 1,
};

/**
 * Result of fallback text generation with metadata about which path was taken.
 */
export interface FallbackResult {
  /** The generated fallback text */
  text: string;
  /** True when the hardcoded generic template was used (not location-specific) */
  isTemplateFallback: boolean;
}

/**
 * Build fallback AI text when primary providers fail, returning metadata
 * about which fallback path was taken.
 *
 * Tries time-aware fallback first (if windows and timestamp available),
 * then falls back to generic fallback text.
 *
 * @param ctx - Brief context with windows and metadata
 * @param config - Optional fallback configuration
 * @returns Fallback result with text and template flag
 */
export function buildFallbackResult(
  ctx: BriefContext,
  config: Partial<FallbackConfig> = {},
): FallbackResult {
  const cfg = { ...DEFAULT_FALLBACK_CONFIG, ...config };
  const generatedAt = ctx.debugContext?.metadata?.generatedAt;

  // Try time-aware fallback if enabled and we have windows
  if (cfg.enableTimeAware && generatedAt && ctx.windows && ctx.windows.length >= cfg.minWindows) {
    const displayPlan = buildWindowDisplayPlan(
      ctx.windows as Parameters<typeof buildWindowDisplayPlan>[0],
      getRunTimeContext(ctx.debugContext as Parameters<typeof getRunTimeContext>[0]).nowMinutes,
    );
    const timeAwareFallback = timeAwareBriefingFallback(displayPlan);
    if (timeAwareFallback) return { text: timeAwareFallback, isTemplateFallback: false };
  }

  // Fall back to generic fallback
  return { text: buildSharedFallbackAiText(ctx), isTemplateFallback: true };
}

/**
 * Build fallback AI text when primary providers fail.
 *
 * Tries time-aware fallback first (if windows and timestamp available),
 * then falls back to generic fallback text.
 *
 * @param ctx - Brief context with windows and metadata
 * @param config - Optional fallback configuration
 * @returns Fallback text string
 */
export function buildFallbackAiText(
  ctx: BriefContext,
  config: Partial<FallbackConfig> = {},
): string {
  return buildFallbackResult(ctx, config).text;
}

/**
 * Build a simple fallback when no context is available.
 *
 * @returns Generic fallback message
 */
export function buildSimpleFallback(): string {
  return 'Unable to generate detailed briefing. Check the forecast windows below for today\'s best photo opportunities.';
}
