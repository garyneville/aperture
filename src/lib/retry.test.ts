import { describe, expect, it, vi } from 'vitest';
import { computeBackoffDelay, retryWithBackoff } from './retry.js';

describe('computeBackoffDelay', () => {
  it('returns baseDelayMs for the first retry', () => {
    expect(computeBackoffDelay(0, 1_000, 3)).toBe(1_000);
  });

  it('applies multiplier for subsequent retries', () => {
    expect(computeBackoffDelay(1, 1_000, 3)).toBe(3_000);
    expect(computeBackoffDelay(2, 1_000, 3)).toBe(9_000);
  });

  it('handles multiplier of 1 (constant delay)', () => {
    expect(computeBackoffDelay(0, 500, 1)).toBe(500);
    expect(computeBackoffDelay(2, 500, 1)).toBe(500);
  });
});

describe('retryWithBackoff', () => {
  it('returns immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
      backoffMultiplier: 1,
    });

    expect(result).toEqual({ value: 'ok', attempts: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and returns on subsequent success', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('recovered');

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
      backoffMultiplier: 1,
    });

    expect(result).toEqual({ value: 'recovered', attempts: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws the last error after all attempts are exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent'));

    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 3,
        baseDelayMs: 1,
        backoffMultiplier: 1,
      }),
    ).rejects.toThrow('permanent');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops retrying when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'));

    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 5,
        baseDelayMs: 1,
        backoffMultiplier: 1,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow('fatal');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry before each retry sleep', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('err1'))
      .mockRejectedValueOnce(new Error('err2'))
      .mockResolvedValueOnce('done');

    await retryWithBackoff(fn, {
      maxAttempts: 4,
      baseDelayMs: 10,
      backoffMultiplier: 3,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1, 10);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2, 30);
  });

  it('works with synchronous functions', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) throw new Error('sync-fail');
      return 'sync-ok';
    };

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
      backoffMultiplier: 1,
    });

    expect(result).toEqual({ value: 'sync-ok', attempts: 2 });
  });

  it('handles maxAttempts of 1 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('once'));

    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 1,
        baseDelayMs: 1,
        backoffMultiplier: 1,
      }),
    ).rejects.toThrow('once');

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
