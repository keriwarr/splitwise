import { describe, it, expect } from 'vitest';
import {
  SplitwiseError,
  SplitwiseApiError,
  SplitwiseAuthenticationError,
  SplitwiseForbiddenError,
  SplitwiseNotFoundError,
  SplitwiseValidationError,
  SplitwiseRateLimitError,
  SplitwiseServerError,
  SplitwiseConstraintError,
  SplitwiseConnectionError,
  createApiError,
  parseRetryAfter,
} from '../../src/errors.js';

describe('Error hierarchy', () => {
  describe('SplitwiseError', () => {
    it('has correct name', () => {
      const err = new SplitwiseError('boom');
      expect(err.name).toBe('SplitwiseError');
    });

    it('extends Error', () => {
      const err = new SplitwiseError('boom');
      expect(err).toBeInstanceOf(Error);
    });

    it('has correct message', () => {
      const err = new SplitwiseError('something went wrong');
      expect(err.message).toBe('something went wrong');
    });
  });

  describe('SplitwiseApiError', () => {
    it('has correct name', () => {
      const err = new SplitwiseApiError(418, 'teapot', 'im_a_teapot', {});
      expect(err.name).toBe('SplitwiseApiError');
    });

    it('extends SplitwiseError and Error', () => {
      const err = new SplitwiseApiError(418, 'teapot', 'im_a_teapot', {});
      expect(err).toBeInstanceOf(SplitwiseError);
      expect(err).toBeInstanceOf(Error);
    });

    it('exposes statusCode, code, raw, and message', () => {
      const raw = { errors: ['bad'] };
      const err = new SplitwiseApiError(422, 'oops', 'unprocessable', raw);
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('unprocessable');
      expect(err.raw).toBe(raw);
      expect(err.message).toBe('oops');
    });
  });

  describe('SplitwiseAuthenticationError', () => {
    it('has correct name and statusCode', () => {
      const err = new SplitwiseAuthenticationError('bad token', 'unauthorized', {});
      expect(err.name).toBe('SplitwiseAuthenticationError');
      expect(err.statusCode).toBe(401);
    });

    it('is instanceof SplitwiseApiError and SplitwiseError', () => {
      const err = new SplitwiseAuthenticationError('bad token', 'unauthorized', {});
      expect(err).toBeInstanceOf(SplitwiseApiError);
      expect(err).toBeInstanceOf(SplitwiseError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('SplitwiseForbiddenError', () => {
    it('has correct name and statusCode', () => {
      const err = new SplitwiseForbiddenError('forbidden', 'forbidden', {});
      expect(err.name).toBe('SplitwiseForbiddenError');
      expect(err.statusCode).toBe(403);
    });

    it('is instanceof SplitwiseApiError', () => {
      const err = new SplitwiseForbiddenError('forbidden', 'forbidden', {});
      expect(err).toBeInstanceOf(SplitwiseApiError);
    });
  });

  describe('SplitwiseNotFoundError', () => {
    it('has correct name and statusCode', () => {
      const err = new SplitwiseNotFoundError('not found', 'not_found', {});
      expect(err.name).toBe('SplitwiseNotFoundError');
      expect(err.statusCode).toBe(404);
    });

    it('is instanceof SplitwiseApiError', () => {
      const err = new SplitwiseNotFoundError('not found', 'not_found', {});
      expect(err).toBeInstanceOf(SplitwiseApiError);
    });
  });

  describe('SplitwiseValidationError', () => {
    it('has correct name and statusCode', () => {
      const err = new SplitwiseValidationError('invalid', 'validation_error', {});
      expect(err.name).toBe('SplitwiseValidationError');
      expect(err.statusCode).toBe(400);
    });

    it('is instanceof SplitwiseApiError', () => {
      const err = new SplitwiseValidationError('invalid', 'validation_error', {});
      expect(err).toBeInstanceOf(SplitwiseApiError);
    });
  });

  describe('SplitwiseRateLimitError', () => {
    it('has correct name and statusCode', () => {
      const err = new SplitwiseRateLimitError('slow down', 'rate_limited', {});
      expect(err.name).toBe('SplitwiseRateLimitError');
      expect(err.statusCode).toBe(429);
    });

    it('stores retryAfter when provided', () => {
      const err = new SplitwiseRateLimitError('slow down', 'rate_limited', {}, 30);
      expect(err.retryAfter).toBe(30);
    });

    it('retryAfter is undefined when not provided', () => {
      const err = new SplitwiseRateLimitError('slow down', 'rate_limited', {});
      expect(err.retryAfter).toBeUndefined();
    });

    it('is instanceof SplitwiseApiError', () => {
      const err = new SplitwiseRateLimitError('slow down', 'rate_limited', {});
      expect(err).toBeInstanceOf(SplitwiseApiError);
    });
  });

  describe('SplitwiseServerError', () => {
    it('has correct name and preserves statusCode', () => {
      const err = new SplitwiseServerError(503, 'unavailable', 'server_error', {});
      expect(err.name).toBe('SplitwiseServerError');
      expect(err.statusCode).toBe(503);
    });

    it('is instanceof SplitwiseApiError', () => {
      const err = new SplitwiseServerError(500, 'internal', 'server_error', {});
      expect(err).toBeInstanceOf(SplitwiseApiError);
    });
  });

  describe('SplitwiseConstraintError', () => {
    it('has correct name', () => {
      const err = new SplitwiseConstraintError('cannot delete', 'errors', {});
      expect(err.name).toBe('SplitwiseConstraintError');
    });

    it('extends SplitwiseApiError and SplitwiseError', () => {
      const err = new SplitwiseConstraintError('cannot delete', 'errors', {});
      expect(err).toBeInstanceOf(SplitwiseApiError);
      expect(err).toBeInstanceOf(SplitwiseError);
      expect(err).toBeInstanceOf(Error);
    });

    it('hardcodes status to 200 (the API returned 200 with success:false)', () => {
      const err = new SplitwiseConstraintError('cannot delete', 'errors', {});
      expect(err.statusCode).toBe(200);
    });

    it('preserves message, code, and raw', () => {
      const raw = { success: false, errors: { base: ['nope'] } };
      const err = new SplitwiseConstraintError('nope', 'errors', raw);
      expect(err.message).toBe('nope');
      expect(err.code).toBe('errors');
      expect(err.raw).toBe(raw);
    });
  });

  describe('SplitwiseConnectionError', () => {
    it('has correct name', () => {
      const err = new SplitwiseConnectionError('network down');
      expect(err.name).toBe('SplitwiseConnectionError');
    });

    it('extends SplitwiseError and Error', () => {
      const err = new SplitwiseConnectionError('network down');
      expect(err).toBeInstanceOf(SplitwiseError);
      expect(err).toBeInstanceOf(Error);
    });

    it('is NOT instanceof SplitwiseApiError', () => {
      const err = new SplitwiseConnectionError('network down');
      expect(err).not.toBeInstanceOf(SplitwiseApiError);
    });

    it('preserves cause when provided', () => {
      const cause = new TypeError('fetch failed');
      const err = new SplitwiseConnectionError('network down', cause);
      expect(err.cause).toBe(cause);
    });

    it('cause is undefined when not provided', () => {
      const err = new SplitwiseConnectionError('network down');
      expect(err.cause).toBeUndefined();
    });

    it('has correct message', () => {
      const err = new SplitwiseConnectionError('DNS resolution failed');
      expect(err.message).toBe('DNS resolution failed');
    });
  });
});

describe('createApiError', () => {
  const raw = { error: 'test' };

  it('returns SplitwiseValidationError for 400', () => {
    const err = createApiError(400, 'bad request', 'validation_error', raw);
    expect(err).toBeInstanceOf(SplitwiseValidationError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('bad request');
    expect(err.code).toBe('validation_error');
    expect(err.raw).toBe(raw);
  });

  it('returns SplitwiseAuthenticationError for 401', () => {
    const err = createApiError(401, 'unauthorized', 'unauthorized', raw);
    expect(err).toBeInstanceOf(SplitwiseAuthenticationError);
    expect(err.statusCode).toBe(401);
  });

  it('returns SplitwiseForbiddenError for 403', () => {
    const err = createApiError(403, 'forbidden', 'forbidden', raw);
    expect(err).toBeInstanceOf(SplitwiseForbiddenError);
    expect(err.statusCode).toBe(403);
  });

  it('returns SplitwiseNotFoundError for 404', () => {
    const err = createApiError(404, 'not found', 'not_found', raw);
    expect(err).toBeInstanceOf(SplitwiseNotFoundError);
    expect(err.statusCode).toBe(404);
  });

  it('returns SplitwiseRateLimitError for 429', () => {
    const err = createApiError(429, 'rate limited', 'rate_limited', raw);
    expect(err).toBeInstanceOf(SplitwiseRateLimitError);
    expect(err.statusCode).toBe(429);
  });

  it('parses Retry-After header for 429', () => {
    const headers = new Headers({ 'retry-after': '60' });
    const err = createApiError(429, 'rate limited', 'rate_limited', raw, headers);
    expect(err).toBeInstanceOf(SplitwiseRateLimitError);
    expect((err as SplitwiseRateLimitError).retryAfter).toBe(60);
  });

  it('sets retryAfter to undefined when Retry-After header is missing', () => {
    const headers = new Headers();
    const err = createApiError(429, 'rate limited', 'rate_limited', raw, headers);
    expect((err as SplitwiseRateLimitError).retryAfter).toBeUndefined();
  });

  it('parses Retry-After in HTTP-date format', () => {
    // The exact value depends on Date.now(), but it should be a non-negative
    // number (the date is 2026-10-21, well in the future at any reasonable
    // run time of this test).
    const headers = new Headers({ 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' });
    const err = createApiError(429, 'rate limited', 'rate_limited', raw, headers);
    const ra = (err as SplitwiseRateLimitError).retryAfter;
    expect(typeof ra).toBe('number');
    expect(ra).toBeGreaterThanOrEqual(0);
  });

  it('sets retryAfter to undefined when Retry-After is malformed', () => {
    const headers = new Headers({ 'retry-after': 'tomorrow maybe' });
    const err = createApiError(429, 'rate limited', 'rate_limited', raw, headers);
    expect((err as SplitwiseRateLimitError).retryAfter).toBeUndefined();
  });

  it('sets retryAfter to undefined when no headers provided', () => {
    const err = createApiError(429, 'rate limited', 'rate_limited', raw);
    expect((err as SplitwiseRateLimitError).retryAfter).toBeUndefined();
  });

  it('returns SplitwiseServerError for 500', () => {
    const err = createApiError(500, 'internal error', 'server_error', raw);
    expect(err).toBeInstanceOf(SplitwiseServerError);
    expect(err.statusCode).toBe(500);
  });

  it('returns SplitwiseServerError for 502', () => {
    const err = createApiError(502, 'bad gateway', 'server_error', raw);
    expect(err).toBeInstanceOf(SplitwiseServerError);
    expect(err.statusCode).toBe(502);
  });

  it('returns SplitwiseServerError for 503', () => {
    const err = createApiError(503, 'unavailable', 'server_error', raw);
    expect(err).toBeInstanceOf(SplitwiseServerError);
    expect(err.statusCode).toBe(503);
  });

  it('returns SplitwiseServerError for 599', () => {
    const err = createApiError(599, 'unknown server', 'server_error', raw);
    expect(err).toBeInstanceOf(SplitwiseServerError);
    expect(err.statusCode).toBe(599);
  });

  it('returns base SplitwiseApiError for unrecognized status codes', () => {
    const err = createApiError(418, 'teapot', 'im_a_teapot', raw);
    expect(err).toBeInstanceOf(SplitwiseApiError);
    expect(err.constructor).toBe(SplitwiseApiError);
    expect(err.statusCode).toBe(418);
  });

  it('all factory results are instanceof SplitwiseApiError and SplitwiseError', () => {
    const codes = [400, 401, 403, 404, 429, 500, 503, 418];
    for (const code of codes) {
      const err = createApiError(code, 'msg', 'code', raw);
      expect(err).toBeInstanceOf(SplitwiseApiError);
      expect(err).toBeInstanceOf(SplitwiseError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});

describe('parseRetryAfter', () => {
  it('parses delta-seconds (integer)', () => {
    expect(parseRetryAfter('120')).toBe(120);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('parses delta-seconds (decimal)', () => {
    expect(parseRetryAfter('1.5')).toBe(1.5);
  });

  it('trims surrounding whitespace', () => {
    expect(parseRetryAfter('  60  ')).toBe(60);
  });

  it('parses HTTP-date format and returns delta to now', () => {
    // 60 seconds in the future
    const fakeNow = Date.UTC(2026, 4, 3, 12, 0, 0);
    const targetDate = new Date(fakeNow + 60_000).toUTCString();
    expect(parseRetryAfter(targetDate, () => fakeNow)).toBe(60);
  });

  it('returns 0 for HTTP-dates in the past', () => {
    const fakeNow = Date.UTC(2026, 4, 3, 12, 0, 0);
    const targetDate = new Date(fakeNow - 60_000).toUTCString();
    expect(parseRetryAfter(targetDate, () => fakeNow)).toBe(0);
  });

  it('returns undefined for null/undefined/empty input', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter(undefined)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
  });

  it('returns undefined for malformed input', () => {
    expect(parseRetryAfter('not a date or number')).toBeUndefined();
    expect(parseRetryAfter('12abc')).toBeUndefined();
    expect(parseRetryAfter('-5')).toBeUndefined();
  });
});
