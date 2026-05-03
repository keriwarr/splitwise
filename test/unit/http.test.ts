import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SplitwiseApiError,
  SplitwiseAuthenticationError,
  SplitwiseConnectionError,
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
      expect(form.get('receipt')).toBeInstanceOf(Blob);
      expect((form.get('receipt') as Blob).type).toBe('image/jpeg');
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

    it('throws on 200 response with errors.base field', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(200, {
          errors: { base: ['Invalid request: cost must be a number'] },
        }),
      );

      const err = await client
        .post('/create_expense', { body: { cost: 'bad' } })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(SplitwiseApiError);
      expect((err as Error).message).toContain('cost must be a number');
    });

    it('throws on 200 response with errors as string array', async () => {
      const { client } = makeClient(async () =>
        jsonResponse(200, { errors: ['something bad happened'] }),
      );

      const err = await client
        .post('/create_expense', { body: {} })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(SplitwiseApiError);
      expect((err as Error).message).toContain('something bad happened');
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
});
