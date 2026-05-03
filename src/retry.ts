/**
 * Retry helper with exponential backoff and jitter.
 *
 * Used by the HTTP client to transparently retry transient failures
 * (network errors, 5xx, 429). Honors a server-provided Retry-After when
 * present.
 */

import {
  SplitwiseConnectionError,
  SplitwiseRateLimitError,
  SplitwiseServerError,
} from './errors.js';

export interface RetryOptions {
  /** Maximum number of retries after the initial attempt. 0 disables retry. */
  maxRetries: number;
  /** Base delay for exponential backoff, in ms. Default 500. */
  baseDelayMs?: number;
  /** Cap on the computed exponential delay, in ms. Default 5000. */
  maxDelayMs?: number;
}

export interface RetryContext {
  /** Attempt number, 1-indexed. The first attempt is 1. */
  attempt: number;
  /** The error from the last attempt. */
  error: unknown;
  /** Optional server-provided Retry-After (in seconds, per HTTP spec). */
  retryAfterSeconds?: number;
}

export type ShouldRetry = (ctx: RetryContext) => boolean;

const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 5000;

/**
 * Default retry policy: retries on transient connection failures, server errors,
 * and rate-limit responses.
 */
export const defaultShouldRetry: ShouldRetry = ({ error }) => {
  return (
    error instanceof SplitwiseConnectionError ||
    error instanceof SplitwiseRateLimitError ||
    error instanceof SplitwiseServerError
  );
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Computes the backoff delay for a given attempt with full jitter.
 * Exposed for testing; the algorithm is otherwise an implementation detail.
 */
export function computeDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  retryAfterSeconds: number | undefined,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(
    baseDelayMs * Math.pow(2, attempt - 1),
    maxDelayMs,
  );
  // Jitter to 50%-100% of the computed delay to avoid thundering-herd retries.
  const jittered = exponential * (0.5 + random() * 0.5);

  if (retryAfterSeconds !== undefined) {
    return Math.max(retryAfterSeconds * 1000, jittered);
  }

  return jittered;
}

/**
 * Runs `fn`, retrying transient failures up to `options.maxRetries` times.
 * Throws the final error if retries are exhausted or the error isn't retryable.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  shouldRetry: ShouldRetry = defaultShouldRetry,
): Promise<T> {
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const totalAttempts = options.maxRetries + 1;

  let lastError: unknown;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const retryAfterSeconds =
        error instanceof SplitwiseRateLimitError
          ? error.retryAfter
          : undefined;

      const isLastAttempt = attempt === totalAttempts;
      if (isLastAttempt) {
        throw error;
      }

      const ctx: RetryContext = { attempt, error, retryAfterSeconds };
      if (!shouldRetry(ctx)) {
        throw error;
      }

      const delayMs = computeDelayMs(
        attempt,
        baseDelayMs,
        maxDelayMs,
        retryAfterSeconds,
      );
      await sleep(delayMs);
    }
  }

  // Unreachable: the loop either returns or throws on every iteration.
  throw lastError;
}
