/**
 * Typed error hierarchy for the Splitwise SDK, following the Stripe pattern.
 *
 * SplitwiseError (base)
 * ├── SplitwiseApiError (HTTP errors from the API)
 * │   ├── SplitwiseAuthenticationError  (401)
 * │   ├── SplitwiseForbiddenError       (403)
 * │   ├── SplitwiseNotFoundError        (404)
 * │   ├── SplitwiseValidationError      (400)
 * │   ├── SplitwiseRateLimitError       (429)
 * │   ├── SplitwiseServerError          (5xx)
 * │   └── SplitwiseConstraintError      (200 with success:false / non-empty errors)
 * └── SplitwiseConnectionError (network failures)
 */

export class SplitwiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SplitwiseError';
  }
}

export class SplitwiseApiError extends SplitwiseError {
  readonly statusCode: number;
  readonly code: string;
  readonly raw: unknown;

  constructor(
    statusCode: number,
    message: string,
    code: string,
    raw: unknown,
  ) {
    super(message);
    this.name = 'SplitwiseApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.raw = raw;
  }
}

export class SplitwiseAuthenticationError extends SplitwiseApiError {
  constructor(message: string, code: string, raw: unknown) {
    super(401, message, code, raw);
    this.name = 'SplitwiseAuthenticationError';
  }
}

export class SplitwiseForbiddenError extends SplitwiseApiError {
  constructor(message: string, code: string, raw: unknown) {
    super(403, message, code, raw);
    this.name = 'SplitwiseForbiddenError';
  }
}

export class SplitwiseNotFoundError extends SplitwiseApiError {
  constructor(message: string, code: string, raw: unknown) {
    super(404, message, code, raw);
    this.name = 'SplitwiseNotFoundError';
  }
}

export class SplitwiseValidationError extends SplitwiseApiError {
  constructor(message: string, code: string, raw: unknown) {
    super(400, message, code, raw);
    this.name = 'SplitwiseValidationError';
  }
}

export class SplitwiseRateLimitError extends SplitwiseApiError {
  /**
   * Server-suggested wait time in seconds, parsed from the Retry-After
   * header. Handles both delta-seconds (e.g. "120") and HTTP-date formats.
   * Undefined when the server didn't send the header or it was malformed.
   */
  readonly retryAfter: number | undefined;

  constructor(
    message: string,
    code: string,
    raw: unknown,
    retryAfter?: number,
  ) {
    super(429, message, code, raw);
    this.name = 'SplitwiseRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class SplitwiseServerError extends SplitwiseApiError {
  constructor(statusCode: number, message: string, code: string, raw: unknown) {
    super(statusCode, message, code, raw);
    this.name = 'SplitwiseServerError';
  }
}

/**
 * Splitwise's "destructive" endpoints (delete_*, undelete_*, add_user_to_group,
 * remove_user_from_group) and some create/update endpoints can return HTTP 200
 * with `success: false` or a non-empty `errors` field when the operation
 * couldn't complete for a domain reason (e.g. trying to delete a friend with a
 * non-zero balance). The SDK surfaces these as a typed exception following the
 * Stripe model -- failures are always thrown, never returned as data.
 */
export class SplitwiseConstraintError extends SplitwiseApiError {
  constructor(message: string, code: string, raw: unknown) {
    super(200, message, code, raw);
    this.name = 'SplitwiseConstraintError';
  }
}

export class SplitwiseConnectionError extends SplitwiseError {
  readonly cause: Error | undefined;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'SplitwiseConnectionError';
    this.cause = cause;
  }
}

/** Minimal interface so we don't depend on the DOM `Headers` type at compile time. */
interface HeadersLike {
  get(name: string): string | null;
}

/**
 * Parse a Retry-After header value, returning the delay in seconds.
 *
 * Per RFC 7231 § 7.1.3 the value can be either:
 *  - a non-negative integer (delta-seconds), e.g. "120"
 *  - an HTTP-date, e.g. "Wed, 21 Oct 2026 07:28:00 GMT"
 *
 * Returns undefined if the value is missing, malformed, or in the past.
 */
export function parseRetryAfter(
  raw: string | null | undefined,
  now: () => number = () => Date.now(),
): number | undefined {
  if (raw === null || raw === undefined || raw.length === 0) return undefined;

  const trimmed = raw.trim();

  // Try delta-seconds first. Use a regex to reject mixed input like "12abc"
  // that Number() would otherwise coerce to NaN-but-then-misleading.
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return seconds >= 0 ? seconds : undefined;
  }

  // Fall back to HTTP-date. Date.parse() is too permissive (e.g. it accepts
  // bare strings like "-5" as years), so we require the input to look like a
  // proper HTTP-date: weekday name + comma + day + month name + ...
  // This matches all three RFC 7231 date formats (IMF-fixdate, obsolete
  // RFC 850, and ANSI C asctime).
  if (!/^[A-Za-z]+(?:,|\s+\d)/.test(trimmed)) return undefined;
  const epochMs = Date.parse(trimmed);
  if (Number.isNaN(epochMs)) return undefined;
  const deltaSeconds = Math.max(0, Math.ceil((epochMs - now()) / 1000));
  return deltaSeconds;
}

/**
 * Maps an HTTP status code to the appropriate SplitwiseApiError subclass.
 */
export function createApiError(
  statusCode: number,
  message: string,
  code: string,
  raw: unknown,
  headers?: HeadersLike,
): SplitwiseApiError {
  switch (statusCode) {
    case 400:
      return new SplitwiseValidationError(message, code, raw);
    case 401:
      return new SplitwiseAuthenticationError(message, code, raw);
    case 403:
      return new SplitwiseForbiddenError(message, code, raw);
    case 404:
      return new SplitwiseNotFoundError(message, code, raw);
    case 429: {
      const retryAfterHeader = headers?.get('retry-after');
      const retryAfter = parseRetryAfter(retryAfterHeader, () => Date.now());
      return new SplitwiseRateLimitError(message, code, raw, retryAfter);
    }
    default:
      if (statusCode >= 500 && statusCode < 600) {
        return new SplitwiseServerError(statusCode, message, code, raw);
      }
      return new SplitwiseApiError(statusCode, message, code, raw);
  }
}
