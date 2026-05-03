import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SplitwiseApiError,
  SplitwiseAuthenticationError,
  SplitwiseConnectionError,
  SplitwiseConstraintError,
  SplitwiseNotFoundError,
  SplitwiseRateLimitError,
  SplitwiseServerError,
} from '../../src/errors.js';
import { HttpClient } from '../../src/http.js';

const BASE_URL = 'https://secure.splitwise.com/api/v3.0';

function jsonResponse(
  status: number,
  body: unknown,
  init: { headers?: Record<string, string>; statusText?: string } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: init.statusText ?? '',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

interface MockClientResult {
  client: HttpClient;
  fetchMock: ReturnType<typeof vi.fn>;
}

function makeClient(
  fetchImpl: (input: string, init: RequestInit) => Promise<Response>,
  overrides: Partial<{
    timeout: number;
    maxRetries: number;
  }> = {},
): MockClientResult {
  const fetchMock = vi.fn(fetchImpl);
  const client = new HttpClient({
    baseUrl: BASE_URL,
    getAccessToken: async () => 'test-token',
    fetch: fetchMock as unknown as typeof fetch,
    timeout: overrides.timeout ?? 30_000,
    maxRetries: overrides.maxRetries ?? 0,
  });
  return { client, fetchMock };
}

describe('HttpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET requests', () => {
    it('builds URL with query params and sends auth header', async () => {
      const { client, fetchMock } = makeClient(async () =>
        jsonResponse(200, { expenses: [] }),
      );

      await client.get('/get_expenses', {
        query: { groupId: 42, limit: 10 },
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(
        `${BASE_URL}/get_expenses?group_id=42&limit=10`,
      );
      expect((init as RequestInit).method).toBe('GET');
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-token');
    });

    it('parses JSON, converts keys to camelCase, unwraps key', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(200, {
          expenses: [
            { id: 1, group_id: 7, created_by: { first_name: 'Ada' } },
          ],
        }),
      );

      const result = await client.get<Array<Record<string, unknown>>>(
        '/get_expenses',
        { unwrapKey: 'expenses' },
      );

      expect(result).toEqual([
        { id: 1, groupId: 7, createdBy: { firstName: 'Ada' } },
      ]);
    });

    it('returns full body when no unwrapKey provided', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(200, { current_user: { id: 1 } }),
      );

      const result = await client.get<Record<string, unknown>>('/get_current_user');
      expect(result).toEqual({ currentUser: { id: 1 } });
    });

    it('skips undefined and null query values', async () => {
      const { client, fetchMock } = makeClient(async () =>
        jsonResponse(200, {}),
      );

      await client.get('/get_expenses', {
        query: { groupId: 1, friendshipId: undefined, limit: null },
      });

      const [url] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${BASE_URL}/get_expenses?group_id=1`);
    });
  });

  describe('POST requests', () => {
    it('serializes form-encoded body with flattened snake_case keys', async () => {
      const { client, fetchMock } = makeClient(async () =>
        jsonResponse(200, { expenses: [{ id: 1 }] }),
      );

      await client.post('/create_expense', {
        body: {
          cost: '10.00',
          description: 'Lunch',
          users: [{ userId: 1, paidShare: '10.00', owedShare: '5.00' }],
        },
      });

      const [, init] = fetchMock.mock.calls[0]!;
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      const body = (init as RequestInit).body as string;
      const parsed = new URLSearchParams(body);
      expect(parsed.get('cost')).toBe('10.00');
      expect(parsed.get('description')).toBe('Lunch');
      expect(parsed.get('users__0__user_id')).toBe('1');
      expect(parsed.get('users__0__paid_share')).toBe('10.00');
      expect(parsed.get('users__0__owed_share')).toBe('5.00');
    });

    it('serializes JSON body when formEncoded=false', async () => {
      const { client, fetchMock } = makeClient(async () =>
        jsonResponse(200, {}),
      );

      await client.post('/some_endpoint', {
        body: { firstName: 'Ada', userId: 1 },
        formEncoded: false,
      });

      const [, init] = fetchMock.mock.calls[0]!;
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect((init as RequestInit).body).toBe(
        JSON.stringify({ first_name: 'Ada', user_id: 1 }),
      );
    });

    it('uses multipart/form-data when body contains a Blob', async () => {
      const { client, fetchMock } = makeClient(async () =>
        jsonResponse(200, { expenses: [{ id: 1 }] }),
      );

      const fakeImage = new Blob(['fake image bytes'], { type: 'image/jpeg' });
      await client.post('/create_expense', {
        body: {
          cost: '10.00',
          description: 'Lunch',
          receipt: fakeImage,
          users: [{ userId: 1, paidShare: '10.00', owedShare: '10.00' }],
        },
      });

      const [, init] = fetchMock.mock.calls[0]!;
      const headers = (init as RequestInit).headers as Record<string, string>;
      // Content-Type must NOT be set manually — fetch handles it for FormData,
      // adding the multipart boundary.
      expect(headers['Content-Type']).toBeUndefined();

      const body = (init as RequestInit).body;
      expect(body).toBeInstanceOf(FormData);
      const form = body as FormData;
      expect(form.get('cost')).toBe('10.00');
      expect(form.get('description')).toBe('Lunch');
      expect(form.get('users__0__user_id')).toBe('1');
      expect(form.get('users__0__paid_share')).toBe('10.00');
      // FormData wraps a bare Blob as a File when given a filename, so the
      // retrieved value is a File (which is a Blob).
      const receipt = form.get('receipt') as Blob;
      expect(receipt).toBeInstanceOf(Blob);
      expect(receipt.type).toBe('image/jpeg');
      // Bare Blob -> default filename derived from the MIME subtype.
      expect((receipt as Blob & { name?: string }).name).toBe('blob.jpeg');
    });

    it('preserves File.name when uploading a File (not a bare Blob)', async () => {
      const { client, fetchMock } = makeClient(async () =>
        jsonResponse(200, { expenses: [{ id: 1 }] }),
      );

      const file = new File(['fake'], 'receipt-2026-05-03.png', {
        type: 'image/png',
      });
      await client.post('/create_expense', {
        body: { cost: '5.00', description: 'X', receipt: file },
      });

      const form = (fetchMock.mock.calls[0]![1] as RequestInit).body as FormData;
      const got = form.get('receipt') as Blob & { name?: string };
      expect(got.name).toBe('receipt-2026-05-03.png');
    });

    it('handles Blobs nested in arrays/objects (uses flattened key)', async () => {
      const { client, fetchMock } = makeClient(async () =>
        jsonResponse(200, {}),
      );

      const blob = new Blob(['x'], { type: 'image/png' });
      await client.post('/something', {
        body: {
          attachments: [{ file: blob, label: 'main' }],
        },
      });

      const form = (fetchMock.mock.calls[0]![1] as RequestInit).body as FormData;
      expect(form.get('attachments__0__file')).toBeInstanceOf(Blob);
      expect(form.get('attachments__0__label')).toBe('main');
    });
  });

  describe('error responses', () => {
    it('throws SplitwiseAuthenticationError on 401', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(401, { error: 'Invalid API request: you are not logged in' }),
      );

      await expect(client.get('/get_current_user')).rejects.toBeInstanceOf(
        SplitwiseAuthenticationError,
      );
    });

    it('throws SplitwiseNotFoundError on 404', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(404, { error: 'Not found' }),
      );

      await expect(client.get('/get_expense/999')).rejects.toBeInstanceOf(
        SplitwiseNotFoundError,
      );
    });

    it('throws SplitwiseRateLimitError with retryAfter on 429', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(
          429,
          { error: 'rate limited' },
          { headers: { 'retry-after': '42' } },
        ),
      );

      try {
        await client.get('/get_expenses');
        expect.fail('expected throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SplitwiseRateLimitError);
        expect((error as SplitwiseRateLimitError).retryAfter).toBe(42);
      }
    });

    it('throws SplitwiseServerError on 500', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(500, { error: 'oops' }),
      );

      await expect(client.get('/get_expenses')).rejects.toBeInstanceOf(
        SplitwiseServerError,
      );
    });

    it('wraps fetch network failure in SplitwiseConnectionError', async () => {
      const { client } = makeClient(async () => {
        throw new TypeError('fetch failed');
      });

      const err = await client
        .get('/get_expenses')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SplitwiseConnectionError);
      expect((err as SplitwiseConnectionError).cause).toBeInstanceOf(TypeError);
    });

    it('throws SplitwiseConstraintError on 200 with errors.base field', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(200, {
          errors: { base: ['Invalid request: cost must be a number'] },
        }),
      );

      const err = await client
        .post('/create_expense', { body: { cost: 'bad' } })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(SplitwiseConstraintError);
      // SplitwiseConstraintError extends SplitwiseApiError, so the broader
      // instanceof check still matches.
      expect(err).toBeInstanceOf(SplitwiseApiError);
      expect((err as Error).message).toContain('cost must be a number');
    });

    it('throws SplitwiseConstraintError on 200 with errors as string array', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(200, { errors: ['something bad happened'] }),
      );

      const err = await client
        .post('/create_expense', { body: {} })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(SplitwiseConstraintError);
      expect((err as Error).message).toContain('something bad happened');
    });

    it('throws SplitwiseConstraintError on 200 with success:false (no errors field)', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(200, { success: false }),
      );

      const err = await client
        .post('/delete_friend/1', {})
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(SplitwiseConstraintError);
      expect((err as SplitwiseConstraintError).code).toBe('success_false');
    });

    it('does not throw on 200 with success:true and empty errors object', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(200, { success: true, errors: {} }),
      );

      await expect(client.post('/delete_expense/1', {})).resolves.toEqual({
        success: true,
        errors: {},
      });
    });

    it('does NOT false-positive on 200 with a top-level "message" field', async () => {
      // Splitwise's actual error envelopes use `errors` or `error` (singular).
      // A response body that happens to include a top-level `message` is not
      // an error -- treating it as one would cause false positives on
      // legitimate response shapes.
      const { client } = makeClient(async () =>
        jsonResponse(200, { message: "Have a nice day", thing: { id: 1 } }),
      );

      await expect(client.get('/get_thing')).resolves.toEqual({
        message: 'Have a nice day',
        thing: { id: 1 },
      });
    });

    it('still uses top-level "message" as a fallback for non-2xx errors', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(500, { message: 'Server is melting' }),
      );

      const err = await client.get('/get_anything').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SplitwiseServerError);
      expect((err as Error).message).toContain('Server is melting');
    });
  });

  describe('retries', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('retries 5xx errors up to maxRetries', async () => {
      let attempt = 0;
      const { client, fetchMock } = makeClient(
        async () => {
          attempt += 1;
          if (attempt < 3) return jsonResponse(500, { error: 'oops' });
          return jsonResponse(200, { ok: true });
        },
        { maxRetries: 2 },
      );

      const promise = client.get<{ ok: boolean }>('/get_expenses');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('does not retry 4xx errors', async () => {
      const { client, fetchMock } = makeClient(
        async () => jsonResponse(400, { error: 'bad' }),
        { maxRetries: 3 },
      );

      const promise = client.get('/get_expenses');
      const settled = promise.catch((e: unknown) => e);
      await vi.runAllTimersAsync();
      const result = await settled;

      expect(result).toBeInstanceOf(SplitwiseApiError);
      expect((result as SplitwiseApiError).statusCode).toBe(400);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout', () => {
    it('aborts request and throws SplitwiseConnectionError', async () => {
      vi.useFakeTimers();
      try {
        const { client } = makeClient(
          async (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
              const signal = (init as RequestInit).signal;
              if (signal) {
                signal.addEventListener('abort', () => {
                  const abortErr = new Error('aborted');
                  abortErr.name = 'AbortError';
                  reject(abortErr);
                });
              }
            }),
          { timeout: 1000, maxRetries: 0 },
        );

        const promise = client.get('/get_expenses');
        const settled = promise.catch((e: unknown) => e);

        await vi.advanceTimersByTimeAsync(1001);
        const result = await settled;

        expect(result).toBeInstanceOf(SplitwiseConnectionError);
        expect((result as Error).message).toContain('timed out');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('empty response bodies', () => {
    it('handles 204 / empty body without throwing on parse', async () => {
      const { client } = makeClient(async () => emptyResponse(204));
      const result = await client.delete('/delete_expense/1');
      // No body -> camelCase of undefined is undefined.
      expect(result).toBeUndefined();
    });
  });

  describe('per-request overrides', () => {
    function abortableFetch(): (url: string, init: RequestInit) => Promise<Response> {
      return (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init.signal as AbortSignal | null;
          const rejectAborted = (): void => {
            const abortErr = new Error('aborted');
            abortErr.name = 'AbortError';
            reject(abortErr);
          };
          if (signal?.aborted === true) {
            rejectAborted();
            return;
          }
          signal?.addEventListener('abort', rejectAborted);
        });
    }

    it('caller-supplied AbortSignal aborts the request', async () => {
      const { client, fetchMock } = makeClient(abortableFetch());

      const controller = new AbortController();
      const promise = client.get('/get_expenses', {
        signal: controller.signal,
      });
      const settled = promise.catch((e: unknown) => e);
      controller.abort();
      const result = await settled;

      expect(result).toBeInstanceOf(SplitwiseConnectionError);
      expect((result as Error).message).toContain('aborted by caller');
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('caller-aborted requests do not retry', async () => {
      const fetchMock = vi.fn(abortableFetch());
      const client = new HttpClient({
        baseUrl: BASE_URL,
        getAccessToken: async () => 'test-token',
        fetch: fetchMock as unknown as typeof fetch,
        maxRetries: 5,
      });

      const controller = new AbortController();
      const settled = client
        .get('/get_expenses', { signal: controller.signal })
        .catch((e: unknown) => e);
      controller.abort();
      await settled;

      // Only the initial attempt should have happened -- retries are skipped.
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('per-request timeout overrides the client default', async () => {
      vi.useFakeTimers();
      try {
        const { client } = makeClient(
          (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
              const signal = (init as RequestInit).signal as AbortSignal | null;
              signal?.addEventListener('abort', () => {
                const abortErr = new Error('aborted');
                abortErr.name = 'AbortError';
                reject(abortErr);
              });
            }),
          { timeout: 100_000, maxRetries: 0 },
        );

        // Caller wants a much shorter timeout for this single request.
        const promise = client.get('/get_expenses', { timeout: 500 });
        const settled = promise.catch((e: unknown) => e);

        await vi.advanceTimersByTimeAsync(501);
        const result = await settled;

        expect(result).toBeInstanceOf(SplitwiseConnectionError);
        expect((result as Error).message).toContain('500ms');
      } finally {
        vi.useRealTimers();
      }
    });

    it('per-request maxRetries=0 disables retry on transient errors', async () => {
      const fetchMock = vi.fn(async () => jsonResponse(503, {}));
      const client = new HttpClient({
        baseUrl: BASE_URL,
        getAccessToken: async () => 'test-token',
        fetch: fetchMock as unknown as typeof fetch,
        maxRetries: 5,
      });

      await client.get('/get_expenses', { maxRetries: 0 }).catch(() => {});
      // 1 attempt, no retries.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('per-request baseUrl overrides the client default', async () => {
      const { client, fetchMock } = makeClient(async () => jsonResponse(200, {}));
      await client.get('/test', { baseUrl: 'https://other.example.com' });
      expect(fetchMock.mock.calls[0]![0]).toBe('https://other.example.com/test');
    });
  });

  describe('hooks', () => {
    it('fires onRequest with redacted Authorization header', async () => {
      const onRequest = vi.fn();
      const fetchMock = vi.fn(async () => jsonResponse(200, {}));
      const client = new HttpClient({
        baseUrl: BASE_URL,
        getAccessToken: async () => 'secret-token',
        fetch: fetchMock as unknown as typeof fetch,
        hooks: { onRequest },
      });

      await client.get('/test');

      expect(onRequest).toHaveBeenCalledOnce();
      const event = onRequest.mock.calls[0]![0];
      expect(event.method).toBe('GET');
      expect(event.url).toContain('/test');
      expect(event.attempt).toBe(1);
      // The real token must NOT be present in the event headers.
      expect(event.headers['Authorization']).toBe('Bearer [REDACTED]');
      expect(event.headers['Authorization']).not.toContain('secret-token');
    });

    it('fires onResponse with status, headers, and durationMs', async () => {
      const onResponse = vi.fn();
      const { client } = makeClient(async () =>
        jsonResponse(200, {}, {
          headers: { 'x-ratelimit-remaining': '99' },
        }),
      );
      const wired = new HttpClient({
        baseUrl: BASE_URL,
        getAccessToken: async () => 't',
        fetch: vi.fn(async () =>
          jsonResponse(200, {}, {
            headers: { 'x-ratelimit-remaining': '99' },
          }),
        ) as unknown as typeof fetch,
        hooks: { onResponse },
      });

      await wired.get('/test');

      expect(onResponse).toHaveBeenCalledOnce();
      const event = onResponse.mock.calls[0]![0];
      expect(event.status).toBe(200);
      expect(event.headers['x-ratelimit-remaining']).toBe('99');
      expect(typeof event.durationMs).toBe('number');
      expect(event.durationMs).toBeGreaterThanOrEqual(0);
      // Suppress unused-var warning.
      void client;
    });

    it('fires onError on transport failure', async () => {
      const onError = vi.fn();
      const fetchMock = vi.fn(async () => {
        throw new TypeError('fetch failed');
      });
      const client = new HttpClient({
        baseUrl: BASE_URL,
        getAccessToken: async () => 't',
        fetch: fetchMock as unknown as typeof fetch,
        hooks: { onError },
        maxRetries: 0,
      });

      await client.get('/test').catch(() => {});

      expect(onError).toHaveBeenCalledOnce();
      const event = onError.mock.calls[0]![0];
      expect(event.error).toBeInstanceOf(SplitwiseConnectionError);
      expect(event.attempt).toBe(1);
    });

    it('fires onError on API error (after onResponse)', async () => {
      const onResponse = vi.fn();
      const onError = vi.fn();
      const fetchMock = vi.fn(async () => jsonResponse(404, { error: 'nope' }));
      const client = new HttpClient({
        baseUrl: BASE_URL,
        getAccessToken: async () => 't',
        fetch: fetchMock as unknown as typeof fetch,
        hooks: { onResponse, onError },
      });

      await client.get('/test').catch(() => {});

      expect(onResponse).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledOnce();
      expect(onError.mock.calls[0]![0].error).toBeInstanceOf(SplitwiseNotFoundError);
    });

    it('attempt increments across retries', async () => {
      const onRequest = vi.fn();
      const responses = [
        jsonResponse(503, {}),
        jsonResponse(503, {}),
        jsonResponse(200, {}),
      ];
      const fetchMock = vi.fn(async () => responses.shift()!);
      const client = new HttpClient({
        baseUrl: BASE_URL,
        getAccessToken: async () => 't',
        fetch: fetchMock as unknown as typeof fetch,
        hooks: { onRequest },
        maxRetries: 2,
      });

      await client.get('/test');

      expect(onRequest).toHaveBeenCalledTimes(3);
      expect(onRequest.mock.calls.map((c) => c[0].attempt)).toEqual([1, 2, 3]);
    });

    it('throwing hooks do not break the SDK', async () => {
      const fetchMock = vi.fn(async () => jsonResponse(200, { ok: true }));
      const client = new HttpClient({
        baseUrl: BASE_URL,
        getAccessToken: async () => 't',
        fetch: fetchMock as unknown as typeof fetch,
        hooks: {
          onRequest: () => {
            throw new Error('hook explosion');
          },
        },
      });

      // The hook throws, but the request should still succeed.
      await expect(client.get('/test')).resolves.toEqual({ ok: true });
    });
  });
});
