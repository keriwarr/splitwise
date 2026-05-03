import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SplitwiseConnectionError,
  SplitwiseRateLimitError,
  SplitwiseServerError,
  SplitwiseValidationError,
} from '../../src/errors.js';
import {
  computeDelayMs,
  defaultShouldRetry,
  withRetry,
} from '../../src/retry.js';

describe('defaultShouldRetry', () => {
  it('retries SplitwiseConnectionError', () => {
    expect(
      defaultShouldRetry({
        attempt: 1,
        error: new SplitwiseConnectionError('boom'),
      }),
    ).toBe(true);
  });

  it('retries SplitwiseRateLimitError', () => {
    expect(
      defaultShouldRetry({
        attempt: 1,
        error: new SplitwiseRateLimitError('slow', 'rl', {}),
      }),
    ).toBe(true);
  });

  it('retries SplitwiseServerError', () => {
    expect(
      defaultShouldRetry({
        attempt: 1,
        error: new SplitwiseServerError(500, 'oops', 'srv', {}),
      }),
    ).toBe(true);
  });

  it('does not retry validation errors', () => {
    expect(
      defaultShouldRetry({
        attempt: 1,
        error: new SplitwiseValidationError('bad', 'val', {}),
      }),
    ).toBe(false);
  });

  it('does not retry plain Errors', () => {
    expect(
      defaultShouldRetry({ attempt: 1, error: new Error('plain') }),
    ).toBe(false);
  });
});

describe('computeDelayMs', () => {
  it('uses exponential backoff', () => {
    // With random() = 1, jitter = exponential * 1.0
    expect(computeDelayMs(1, 500, 5000, undefined, () => 1)).toBe(500);
    expect(computeDelayMs(2, 500, 5000, undefined, () => 1)).toBe(1000);
    expect(computeDelayMs(3, 500, 5000, undefined, () => 1)).toBe(2000);
  });

  it('caps at maxDelayMs before applying jitter', () => {
    // 500 * 2^9 = 256000, capped to 5000, then jittered to 100% = 5000
    expect(computeDelayMs(10, 500, 5000, undefined, () => 1)).toBe(5000);
  });

  it('applies jitter in the 50%-100% range', () => {
    // Lowest jitter: 50% of computed delay
    expect(computeDelayMs(1, 500, 5000, undefined, () => 0)).toBe(250);
    // Highest jitter: 100% of computed delay
    expect(computeDelayMs(1, 500, 5000, undefined, () => 1)).toBe(500);
  });

  it('uses retryAfterSeconds when larger than computed', () => {
    // retryAfterSeconds=10 -> 10000ms, beats any normal jitter
    expect(computeDelayMs(1, 500, 5000, 10, () => 1)).toBe(10000);
  });

  it('uses computed when larger than retryAfterSeconds', () => {
    // retryAfterSeconds=0.1 -> 100ms; computed at attempt 1 with random=1 is 500
    expect(computeDelayMs(1, 500, 5000, 0.1, () => 1)).toBe(500);
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns immediately on success without retries', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await withRetry(fn, { maxRetries: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable errors up to maxRetries times', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new SplitwiseConnectionError('1'))
      .mockRejectedValueOnce(new SplitwiseConnectionError('2'))
      .mockResolvedValueOnce('success');

    const promise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    });

    // Drain timers + microtasks until the retry chain completes.
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-retryable errors', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new SplitwiseValidationError('nope', 'val', {}));

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toBeInstanceOf(
      SplitwiseValidationError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws final error after exhausting retries', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new SplitwiseConnectionError('always fails'));

    const promise = withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 10,
      maxDelayMs: 100,
    });
    // Catch on the promise immediately so the test runner doesn't see an
    // unhandled rejection while we're advancing fake timers.
    const settled = promise.catch((e: unknown) => e);

    await vi.runAllTimersAsync();
    const result = await settled;

    expect(result).toBeInstanceOf(SplitwiseConnectionError);
    // Initial attempt + 2 retries = 3 calls.
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('honors retryAfter from RateLimitError', async () => {
    // Force jitter to 100% so the baseline computed delay is deterministic.
    vi.spyOn(Math, 'random').mockReturnValue(1);

    const rateLimited = new SplitwiseRateLimitError('slow', 'rl', {}, 5);
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(rateLimited)
      .mockResolvedValueOnce('done');

    const promise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    });

    // Advance just under retry-after; fn should not yet have been re-called.
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fn).toHaveBeenCalledTimes(1);

    // Cross the retry-after boundary; the second attempt should run.
    await vi.advanceTimersByTimeAsync(1);
    const result = await promise;

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses exponential backoff (jitter range)', async () => {
    // With random() = 0.5, attempt 1 jitter = base * 0.75
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new SplitwiseConnectionError('1'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 200,
      maxDelayMs: 5000,
    });

    // Expected delay: 200 * 2^0 * (0.5 + 0.5*0.5) = 200 * 0.75 = 150ms
    await vi.advanceTimersByTimeAsync(149);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('treats maxRetries=0 as no retries', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new SplitwiseConnectionError('boom'));

    await expect(withRetry(fn, { maxRetries: 0 })).rejects.toBeInstanceOf(
      SplitwiseConnectionError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects a custom shouldRetry predicate', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new SplitwiseConnectionError('1'))
      .mockResolvedValueOnce('ok');

    // A predicate that never retries -> initial attempt throws.
    await expect(
      withRetry(fn, { maxRetries: 3 }, () => false),
    ).rejects.toBeInstanceOf(SplitwiseConnectionError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
