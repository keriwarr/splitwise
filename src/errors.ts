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
 * │   └── SplitwiseServerError          (5xx)
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
      const retryAfter =
        retryAfterHeader !== null && retryAfterHeader !== undefined
          ? Number(retryAfterHeader)
          : undefined;
      return new SplitwiseRateLimitError(
        message,
        code,
        raw,
        retryAfter !== undefined && !Number.isNaN(retryAfter)
          ? retryAfter
          : undefined,
      );
    }
    default:
      if (statusCode >= 500 && statusCode < 600) {
        return new SplitwiseServerError(statusCode, message, code, raw);
      }
      return new SplitwiseApiError(statusCode, message, code, raw);
  }
}
