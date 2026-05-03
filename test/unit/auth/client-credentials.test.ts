import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchClientCredentialsToken } from '../../../src/auth/client-credentials.js';
import {
  SplitwiseAuthenticationError,
  SplitwiseConnectionError,
  SplitwiseServerError,
} from '../../../src/errors.js';

const TOKEN_URL = 'https://secure.splitwise.com/oauth/token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchClientCredentialsToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns OAuthToken with correct fields on success', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        access_token: 'tok_abc',
        token_type: 'bearer',
      }),
    );

    const token = await fetchClientCredentialsToken(
      { clientId: 'id', clientSecret: 'secret' },
      { fetch: fetchMock as unknown as typeof fetch },
    );

    expect(token.accessToken).toBe('tok_abc');
    expect(token.tokenType).toBe('bearer');
    expect(token.expiresAt).toBeUndefined();
    expect(token.refreshToken).toBeUndefined();
  });

  it('posts form-encoded body to default token URL with grant params', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { access_token: 't', token_type: 'bearer' }),
    );

    await fetchClientCredentialsToken(
      { clientId: 'my-id', clientSecret: 'my-secret' },
      { fetch: fetchMock as unknown as typeof fetch },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(TOKEN_URL);

    const reqInit = init as RequestInit;
    expect(reqInit.method).toBe('POST');

    const headers = reqInit.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    const body = new URLSearchParams(reqInit.body as string);
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_id')).toBe('my-id');
    expect(body.get('client_secret')).toBe('my-secret');
  });

  it('computes expiresAt correctly from expires_in', async () => {
    const before = Date.now();
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        access_token: 'tok',
        token_type: 'bearer',
        expires_in: 3600,
      }),
    );

    const token = await fetchClientCredentialsToken(
      { clientId: 'id', clientSecret: 'secret' },
      { fetch: fetchMock as unknown as typeof fetch },
    );
    const after = Date.now();

    expect(token.expiresAt).toBeDefined();
    // 3600s = 3_600_000ms; allow a window for the call duration.
    expect(token.expiresAt!).toBeGreaterThanOrEqual(before + 3_600_000);
    expect(token.expiresAt!).toBeLessThanOrEqual(after + 3_600_000);
  });

  it('throws SplitwiseAuthenticationError on 401', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, {
        error: 'invalid_client',
        error_description: 'Bad client credentials',
      }),
    );

    const err = await fetchClientCredentialsToken(
      { clientId: 'id', clientSecret: 'wrong' },
      { fetch: fetchMock as unknown as typeof fetch },
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SplitwiseAuthenticationError);
    expect((err as SplitwiseAuthenticationError).statusCode).toBe(401);
    expect((err as Error).message).toContain('Bad client credentials');
    expect((err as SplitwiseAuthenticationError).code).toBe('invalid_client');
  });

  it('throws SplitwiseAuthenticationError on 400 invalid_grant', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, { error: 'invalid_grant' }),
    );

    const err = await fetchClientCredentialsToken(
      { clientId: 'id', clientSecret: 'secret' },
      { fetch: fetchMock as unknown as typeof fetch },
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SplitwiseAuthenticationError);
  });

  it('throws SplitwiseServerError on 500 (retries exhausted)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(500, { error: 'server_error' }),
    );

    const err = await fetchClientCredentialsToken(
      { clientId: 'id', clientSecret: 'secret' },
      { fetch: fetchMock as unknown as typeof fetch, maxRetries: 0 },
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SplitwiseServerError);
  });

  it('throws SplitwiseConnectionError on network failure (retries exhausted)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });

    const err = await fetchClientCredentialsToken(
      { clientId: 'id', clientSecret: 'secret' },
      { fetch: fetchMock as unknown as typeof fetch, maxRetries: 0 },
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SplitwiseConnectionError);
    expect((err as SplitwiseConnectionError).cause).toBeInstanceOf(TypeError);
  });

  it('uses custom tokenUrl when provided', async () => {
    const customUrl = 'https://example.test/oauth/token';
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { access_token: 'tok', token_type: 'bearer' }),
    );

    await fetchClientCredentialsToken(
      { clientId: 'id', clientSecret: 'secret' },
      {
        fetch: fetchMock as unknown as typeof fetch,
        tokenUrl: customUrl,
      },
    );

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(customUrl);
  });

  it('throws SplitwiseAuthenticationError if response is missing access_token', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { token_type: 'bearer' }),
    );

    const err = await fetchClientCredentialsToken(
      { clientId: 'id', clientSecret: 'secret' },
      { fetch: fetchMock as unknown as typeof fetch },
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SplitwiseAuthenticationError);
  });

  it('retries 5xx responses (up to maxRetries)', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn(async () => jsonResponse(500, { error: 'oops' }))
        .mockResolvedValueOnce(jsonResponse(503, { error: 'oops' }))
        .mockResolvedValueOnce(jsonResponse(503, { error: 'oops' }))
        .mockResolvedValueOnce(
          jsonResponse(200, { access_token: 'tok', token_type: 'bearer' }),
        );

      const promise = fetchClientCredentialsToken(
        { clientId: 'id', clientSecret: 'secret' },
        {
          fetch: fetchMock as unknown as typeof fetch,
          maxRetries: 2,
        },
      );

      // Two retries means two backoff sleeps; with default config the
      // longest is bounded by maxDelayMs=5000.
      await vi.advanceTimersByTimeAsync(20_000);
      const token = await promise;

      expect(token.accessToken).toBe('tok');
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does NOT retry 401/400 (bad credentials are not transient)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, { error: 'invalid_client' }),
    );

    await fetchClientCredentialsToken(
      { clientId: 'id', clientSecret: 'wrong' },
      {
        fetch: fetchMock as unknown as typeof fetch,
        maxRetries: 5,
      },
    ).catch(() => {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honors a per-request timeout', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init.signal as AbortSignal | null;
            signal?.addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }),
      );

      const promise = fetchClientCredentialsToken(
        { clientId: 'id', clientSecret: 'secret' },
        {
          fetch: fetchMock as unknown as typeof fetch,
          timeout: 500,
          maxRetries: 0,
        },
      );
      const settled = promise.catch((e: unknown) => e);

      await vi.advanceTimersByTimeAsync(501);
      const result = await settled;

      expect(result).toBeInstanceOf(SplitwiseConnectionError);
      expect((result as Error).message).toContain('timed out');
    } finally {
      vi.useRealTimers();
    }
  });

  it('honors a caller-supplied AbortSignal', async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init.signal as AbortSignal | null;
          if (signal?.aborted === true) {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const controller = new AbortController();
    const promise = fetchClientCredentialsToken(
      { clientId: 'id', clientSecret: 'secret' },
      {
        fetch: fetchMock as unknown as typeof fetch,
        signal: controller.signal,
      },
    );
    const settled = promise.catch((e: unknown) => e);
    controller.abort();
    const result = await settled;

    expect(result).toBeInstanceOf(SplitwiseConnectionError);
    expect((result as Error).message).toContain('aborted by caller');
  });
});
