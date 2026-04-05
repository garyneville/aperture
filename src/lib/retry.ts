/**
 * Retry with exponential backoff.
 *
 * General-purpose retry utility for transient failures such as HTTP 429 or
 * empty-response errors from AI editorial providers.
 *
 * Usage:
 * ```ts
 * const result = await retryWithBackoff(() => callProvider(), {
 *   maxAttempts: 3,
 *   baseDelayMs: 1_000,
 *   backoffMultiplier: 3,
 *   shouldRetry: (err) => isTransient(err),
 * });
 * ```
 */

export interface RetryOptions {
  /** Maximum number of attempts (including the initial call). Must be ≥ 1. */
  maxAttempts: number;
  /** Base delay in milliseconds before the first retry. */
  baseDelayMs: number;
  /** Multiplier applied to the delay after each retry (e.g. 3 → 1s, 3s, 9s). */
  backoffMultiplier: number;
  /**
   * Optional predicate to decide whether to retry.
   * Called with the error from the most recent attempt and the 1-based attempt number.
   * Return `true` to retry, `false` to rethrow immediately.
   * If omitted, all errors are retried up to `maxAttempts`.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /**
   * Optional callback invoked before each retry sleep.
   * Useful for structured logging of retry attempts.
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export interface RetryResult<T> {
  /** The successful return value. */
  value: T;
  /** Total number of attempts made (1 = no retries). */
  attempts: number;
}

/** Compute the delay before the Nth retry (0-indexed). */
export function computeBackoffDelay(
  retryIndex: number,
  baseDelayMs: number,
  multiplier: number,
): number {
  return baseDelayMs * multiplier ** retryIndex;
}

/**
 * Execute `fn` up to `opts.maxAttempts` times with exponential backoff.
 *
 * On each failure the utility waits `baseDelayMs * backoffMultiplier^retryIndex`
 * milliseconds before retrying. If all attempts fail the last error is rethrown.
 */
export async function retryWithBackoff<T>(
  fn: () => T | Promise<T>,
  opts: RetryOptions,
): Promise<RetryResult<T>> {
  const { maxAttempts, baseDelayMs, backoffMultiplier, shouldRetry, onRetry } = opts;
  const clampedAttempts = Math.max(1, maxAttempts);

  let lastError: unknown;

  for (let attempt = 1; attempt <= clampedAttempts; attempt++) {
    try {
      const value = await fn();
      return { value, attempts: attempt };
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt >= clampedAttempts;
      if (isLastAttempt) break;

      if (shouldRetry && !shouldRetry(err, attempt)) break;

      const delayMs = computeBackoffDelay(attempt - 1, baseDelayMs, backoffMultiplier);
      if (onRetry) onRetry(err, attempt, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
