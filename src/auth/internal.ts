/**
 * Shared internals for the OAuth token endpoint:
 *  - POSTing form-encoded credentials
 *  - Parsing the response into an OAuthToken
 *  - Translating HTTP/network failures into SDK error types
 *
 * Both client-credentials and authorization-code flows hit the same endpoint
 * with the same response shape, so they share this code path.
 */

import {
  SplitwiseAuthenticationError,
  SplitwiseConnectionError,
  createApiError,
} from '../errors.js';
import { withRetry } from '../retry.js';
import type { OAuthToken } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

export const DEFAULT_TOKEN_URL = 'https://secure.splitwise.com/oauth/token';
export const DEFAULT_AUTHORIZE_URL =
  'https://secure.splitwise.com/oauth/authorize';

interface TokenResponseBody {
  access_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  error?: unknown;
  error_description?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractOAuthErrorMessage(body: unknown): string | null {
  if (!isPlainObject(body)) return null;
  const errorDescription = body['error_description'];
  if (typeof errorDescription === 'string' && errorDescription.length > 0) {
    return errorDescription;
  }
  const error = body['error'];
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  return null;
}

function extractOAuthErrorCode(body: unknown): string {
  if (isPlainObject(body) && typeof body['error'] === 'string') {
    return body['error'];
  }
  return 'oauth_error';
}

export interface PostTokenRequestOptions {
  fetch?: typeof fetch;
  tokenUrl?: string;
  /** Per-request timeout in ms. Default 30000. */
  timeout?: number;
  /** Max retries for transient failures (network errors, 5xx). Default 2. */
  maxRetries?: number;
  /** Optional caller-supplied AbortSignal. */
  signal?: AbortSignal;
}

/**
 * POSTs `params` form-encoded to the token endpoint and returns the parsed token.
 *
 * 401/400 responses are mapped to SplitwiseAuthenticationError because the OAuth
 * spec uses 400 for things like `invalid_grant` even though the SDK normally
 * reserves 400 for validation errors.
 *
 * Honors timeout, AbortSignal, and exponential-backoff retry on transient
 * failures (matching the main HttpClient's behavior). 4xx responses are not
 * retried since they indicate the credentials themselves are bad.
 */
export async function postTokenRequest(
  params: Record<string, string>,
  options: PostTokenRequestOptions = {},
): Promise<OAuthToken> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const callerSignal = options.signal;

  return withRetry(
    () => postTokenRequestOnce(params, options),
    { maxRetries },
    ({ error }) => {
      // Don't burn through retries if the caller has given up.
      if (callerSignal?.aborted === true) return false;
      // Network failures and 5xx are retryable; 4xx (bad credentials) are not.
      // We can't easily import SplitwiseServerError from here without making the
      // dep cycle awkward, so we check the class name.
      if (error instanceof SplitwiseConnectionError) return true;
      if (error instanceof Error && error.name === 'SplitwiseServerError') {
        return true;
      }
      return false;
    },
  );
}

async function postTokenRequestOnce(
  params: Record<string, string>,
  options: PostTokenRequestOptions,
): Promise<OAuthToken> {
  const tokenUrl = options.tokenUrl ?? DEFAULT_TOKEN_URL;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl =
    options.fetch ??
    (globalThis as { fetch: typeof fetch }).fetch.bind(globalThis);

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value);
  }

  // Compose the timeout-driven controller with any caller-supplied signal,
  // matching HttpClient.requestOnce.
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeout);
  const callerSignal = options.signal;
  let abortListenerCleanup: (() => void) | undefined;
  if (callerSignal !== undefined) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      const onAbort = (): void => {
        controller.abort();
      };
      callerSignal.addEventListener('abort', onAbort);
      abortListenerCleanup = (): void => {
        callerSignal.removeEventListener('abort', onAbort);
      };
    }
  }

  let response: Response;
  try {
    response = await fetchImpl(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      if (callerSignal?.aborted === true) {
        throw new SplitwiseConnectionError(
          'OAuth token request aborted by caller',
          err,
        );
      }
      throw new SplitwiseConnectionError(
        `OAuth token request timed out after ${timeout}ms`,
        err,
      );
    }
    throw new SplitwiseConnectionError(
      err.message || 'Network request failed',
      err,
    );
  } finally {
    clearTimeout(timeoutHandle);
    abortListenerCleanup?.();
  }

  const rawText = await response.text();
  let parsed: unknown = undefined;
  if (rawText.length > 0) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Non-JSON body; leave parsed undefined and fall back to raw text below.
    }
  }

  if (!response.ok) {
    const message =
      extractOAuthErrorMessage(parsed) ??
      `HTTP ${response.status} ${response.statusText || ''}`.trim();
    const code = extractOAuthErrorCode(parsed);

    if (response.status === 400 || response.status === 401) {
      throw new SplitwiseAuthenticationError(
        message,
        code,
        parsed ?? rawText,
      );
    }

    throw createApiError(
      response.status,
      message,
      code,
      parsed ?? rawText,
      response.headers,
    );
  }

  const body_ = parsed as TokenResponseBody | undefined;
  const accessToken = body_?.access_token;
  const tokenType = body_?.token_type;

  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new SplitwiseAuthenticationError(
      'OAuth token response missing access_token',
      'invalid_response',
      parsed ?? rawText,
    );
  }

  const token: OAuthToken = {
    accessToken,
    tokenType: typeof tokenType === 'string' ? tokenType : 'bearer',
  };

  if (typeof body_?.expires_in === 'number' && Number.isFinite(body_.expires_in)) {
    token.expiresAt = Date.now() + body_.expires_in * 1000;
  }

  if (typeof body_?.refresh_token === 'string' && body_.refresh_token.length > 0) {
    token.refreshToken = body_.refresh_token;
  }

  return token;
}
