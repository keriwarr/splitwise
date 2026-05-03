import { describe, expect, it, vi } from 'vitest';
import { Splitwise } from '../../src/client.js';
import { SplitwiseAuthenticationError } from '../../src/errors.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Splitwise client', () => {
  describe('configuration', () => {
    it('throws when no auth is provided', () => {
      expect(() => new Splitwise({})).toThrow(/accessToken.*consumerKey/);
    });

    it('throws on unknown config option', () => {
      expect(
        () =>
          new Splitwise({
            accessToken: 't',
            // @ts-expect-error - testing runtime validation
            consumerSecrte: 'typo',
          }),
      ).toThrow(/Unknown.*consumerSecrte/);
    });

    it('accepts accessToken alone', () => {
      expect(() => new Splitwise({ accessToken: 't' })).not.toThrow();
    });

    it('accepts consumerKey + consumerSecret', () => {
      expect(
        () => new Splitwise({ consumerKey: 'k', consumerSecret: 's' }),
      ).not.toThrow();
    });

    it('rejects partial credentials', () => {
      expect(() => new Splitwise({ consumerKey: 'k' })).toThrow();
      expect(() => new Splitwise({ consumerSecret: 's' })).toThrow();
    });

    it('rejects empty-string accessToken', () => {
      expect(() => new Splitwise({ accessToken: '' })).toThrow(/empty string/);
    });

    it('rejects empty-string consumerKey/consumerSecret', () => {
      expect(
        () => new Splitwise({ consumerKey: '', consumerSecret: 's' }),
      ).toThrow(/empty string/);
      expect(
        () => new Splitwise({ consumerKey: 'k', consumerSecret: '' }),
      ).toThrow(/empty string/);
    });

    it('gives a helpful error for v1 default-ID config keys', () => {
      expect(
        () =>
          new Splitwise({
            accessToken: 't',
            // @ts-expect-error - testing v1 compatibility error
            group_id: 123,
          }),
      ).toThrow(/group_id.*default-ID/);
    });
  });

  describe('resources', () => {
    it('exposes all 8 resource namespaces', () => {
      const sw = new Splitwise({ accessToken: 't' });
      expect(sw.expenses).toBeDefined();
      expect(sw.groups).toBeDefined();
      expect(sw.users).toBeDefined();
      expect(sw.friends).toBeDefined();
      expect(sw.comments).toBeDefined();
      expect(sw.notifications).toBeDefined();
      expect(sw.currencies).toBeDefined();
      expect(sw.categories).toBeDefined();
    });
  });

  describe('end-to-end with mock fetch', () => {
    it('sends User-Agent with the SDK version by default', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ user: { id: 1, first_name: 'X', last_name: 'Y' } }),
      );
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      await sw.users.getCurrent();
      const [, init] = fetchImpl.mock.calls[0]!;
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['User-Agent']).toMatch(/^splitwise-node\/\d/);
    });

    it('appends appInfo to the User-Agent', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ user: { id: 1, first_name: 'X', last_name: 'Y' } }),
      );
      const sw = new Splitwise({
        accessToken: 't',
        fetch: fetchImpl,
        appInfo: {
          name: 'my-app',
          version: '1.4.2',
          url: 'https://github.com/me/my-app',
        },
      });
      await sw.users.getCurrent();
      const [, init] = fetchImpl.mock.calls[0]!;
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['User-Agent']).toMatch(
        /^splitwise-node\/\S+ my-app\/1\.4\.2 \(https:\/\/github\.com\/me\/my-app\)$/,
      );
    });

    it('appInfo with only name still produces a valid User-Agent', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ user: { id: 1, first_name: 'X', last_name: 'Y' } }),
      );
      const sw = new Splitwise({
        accessToken: 't',
        fetch: fetchImpl,
        appInfo: { name: 'minimal-app' },
      });
      await sw.users.getCurrent();
      const [, init] = fetchImpl.mock.calls[0]!;
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['User-Agent']).toMatch(/^splitwise-node\/\S+ minimal-app$/);
    });

    it('uses provided accessToken as bearer', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ user: { id: 1, first_name: 'Test', last_name: 'User' } }),
      );
      const sw = new Splitwise({ accessToken: 'my-token', fetch: fetchImpl });
      await sw.users.getCurrent();
      expect(fetchImpl).toHaveBeenCalledOnce();
      const [, init] = fetchImpl.mock.calls[0]!;
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer my-token');
    });

    it('converts response keys to camelCase', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({
          user: {
            id: 42,
            first_name: 'Ada',
            last_name: 'Lovelace',
            default_currency: 'GBP',
          },
        }),
      );
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      const user = await sw.users.getCurrent();
      expect(user.firstName).toBe('Ada');
      expect(user.lastName).toBe('Lovelace');
      expect(user.defaultCurrency).toBe('GBP');
    });

    it('serializes request body as form-urlencoded snake_case', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ expenses: [{ id: 1, description: 'Lunch' }] }),
      );
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      await sw.expenses.create({
        cost: '15.00',
        description: 'Lunch',
        groupId: 99,
        currencyCode: 'USD',
        users: [
          { userId: 1, paidShare: '15.00', owedShare: '7.50' },
          { userId: 2, paidShare: '0', owedShare: '7.50' },
        ],
      });
      const [, init] = fetchImpl.mock.calls[0]!;
      const body = (init as RequestInit).body as string;
      expect(body).toContain('cost=15.00');
      expect(body).toContain('group_id=99');
      expect(body).toContain('currency_code=USD');
      expect(body).toContain('users__0__user_id=1');
      expect(body).toContain('users__0__paid_share=15.00');
      expect(body).toContain('users__1__owed_share=7.50');
    });

    it('uses Client Credentials flow when consumer key/secret provided', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.includes('/oauth/token')) {
          return jsonResponse({
            access_token: 'fetched-token',
            token_type: 'bearer',
          });
        }
        return jsonResponse({ currencies: [{ currency_code: 'USD', unit: '$' }] });
      });
      const sw = new Splitwise({
        consumerKey: 'k',
        consumerSecret: 's',
        fetch: fetchImpl as unknown as typeof fetch,
      });
      await sw.currencies.list();
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      const tokenCall = fetchImpl.mock.calls[0]![0];
      expect(tokenCall).toContain('/oauth/token');
      const apiCall = fetchImpl.mock.calls[1]!;
      const apiHeaders = (apiCall[1] as RequestInit).headers as Record<string, string>;
      expect(apiHeaders['Authorization']).toBe('Bearer fetched-token');
    });

    it('exposes getAccessToken() returning the in-use token', async () => {
      const sw = new Splitwise({ accessToken: 'plain-token' });
      await expect(sw.getAccessToken()).resolves.toBe('plain-token');
    });

    it('getAccessToken() fetches via Client Credentials when no accessToken', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ access_token: 'fetched-via-creds', token_type: 'bearer' }),
      );
      const sw = new Splitwise({
        consumerKey: 'k',
        consumerSecret: 's',
        fetch: fetchImpl as unknown as typeof fetch,
      });
      await expect(sw.getAccessToken()).resolves.toBe('fetched-via-creds');
    });

    it('caches the OAuth token across requests', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.includes('/oauth/token')) {
          return jsonResponse({
            access_token: 'fetched-token',
            token_type: 'bearer',
          });
        }
        return jsonResponse({ currencies: [] });
      });
      const sw = new Splitwise({
        consumerKey: 'k',
        consumerSecret: 's',
        fetch: fetchImpl as unknown as typeof fetch,
      });
      await sw.currencies.list();
      await sw.currencies.list();
      await sw.currencies.list();
      // 1 token fetch + 3 API calls
      expect(fetchImpl).toHaveBeenCalledTimes(4);
    });

    it('dedupes concurrent token fetches (no thundering herd)', async () => {
      // Manually-resolvable token fetch lets us start three callers, then
      // confirm they're all waiting on the same in-flight Promise before
      // resolving once. Without dedup, we'd see 3 token fetches; with dedup, 1.
      let tokenFetchCount = 0;
      let resolveTokenFetch: ((res: Response) => void) | undefined;
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.includes('/oauth/token')) {
          tokenFetchCount += 1;
          return new Promise<Response>((resolve) => {
            resolveTokenFetch = resolve;
          });
        }
        return jsonResponse({ currencies: [] });
      });
      const sw = new Splitwise({
        consumerKey: 'k',
        consumerSecret: 's',
        fetch: fetchImpl as unknown as typeof fetch,
      });
      // Kick off three concurrent calls -- they should all park on the same
      // in-flight token fetch instead of starting their own.
      const all = Promise.all([
        sw.currencies.list(),
        sw.currencies.list(),
        sw.currencies.list(),
      ]);
      // Give the event loop a tick so all three callers reach getAccessToken().
      await new Promise<void>((r) => queueMicrotask(r));
      expect(tokenFetchCount).toBe(1);
      // Now resolve the token fetch and let the API calls complete.
      resolveTokenFetch!(
        jsonResponse({ access_token: 'fetched-token', token_type: 'bearer' }),
      );
      await all;
      expect(tokenFetchCount).toBe(1);
    });

    it('fromAuthorizationCode preserves token expiry/refresh metadata', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({
          access_token: 'tok123',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'refresh-xyz',
        }),
      );
      const sw = await Splitwise.fromAuthorizationCode(
        {
          clientId: 'cid',
          clientSecret: 'cs',
          code: 'authcode',
          codeVerifier: 'verifier',
          redirectUri: 'http://localhost:3000/callback',
        },
        { fetch: fetchImpl as unknown as typeof fetch },
      );
      const stored = sw.getOAuthToken();
      expect(stored?.accessToken).toBe('tok123');
      expect(stored?.refreshToken).toBe('refresh-xyz');
      expect(stored?.expiresAt).toBeGreaterThan(Date.now());
    });

    it('fromAuthorizationCode-sourced client throws when token expires (no silent fall-through)', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.includes('/oauth/token')) {
          return jsonResponse({
            access_token: 'tok-soon-expired',
            token_type: 'bearer',
            // Negative -> already past the 60s eager-refresh window the SDK uses.
            expires_in: -120,
          });
        }
        return jsonResponse({ user: { id: 1, first_name: 'X', last_name: null } });
      });
      const sw = await Splitwise.fromAuthorizationCode(
        {
          clientId: 'cid',
          clientSecret: 'cs',
          code: 'authcode',
          codeVerifier: 'verifier',
          redirectUri: 'http://localhost:3000/callback',
        },
        { fetch: fetchImpl as unknown as typeof fetch },
      );
      // The cached token is already expired; we used to silently fall back
      // to config.accessToken (the same expired token). Now we throw a
      // clear authentication error.
      await expect(sw.getAccessToken()).rejects.toThrow(/expired/i);
      await expect(sw.users.getCurrent()).rejects.toThrow(
        SplitwiseAuthenticationError,
      );
    });

    it('propagates auth errors from token fetch', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ error: 'invalid_client' }, 401),
      );
      const sw = new Splitwise({
        consumerKey: 'k',
        consumerSecret: 's',
        fetch: fetchImpl as unknown as typeof fetch,
      });
      await expect(sw.currencies.list()).rejects.toThrow(
        SplitwiseAuthenticationError,
      );
    });
  });

  describe('top-level utility methods', () => {
    it('test() returns the whoami payload (client_id, token, etc.)', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({
          client_id: 11454,
          token: { access_token: 'tok123', token_type: 'bearer' },
          request_url: 'https://secure.splitwise.com/api/v3.0/test',
          params: {},
        }),
      );
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      const result = await sw.test();
      expect(result.clientId).toBe(11454);
      expect(result.token.accessToken).toBe('tok123');
      expect(result.token.tokenType).toBe('bearer');
      expect(result.requestUrl).toContain('/test');
    });

    it('parseSentence posts to /parse_sentence', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ expense: { id: 1 } }),
      );
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      await sw.parseSentence({ input: 'I owe Bob $10' });
      const [url] = fetchImpl.mock.calls[0]!;
      expect(url).toContain('/parse_sentence');
    });

    it('parseSentence returns valid:false + error as data (not as exception)', async () => {
      // Unlike most endpoints, parse_sentence reports failures via `valid`
      // and `error` in the response body, not via SplitwiseConstraintError.
      const fetchImpl = vi.fn(async () =>
        jsonResponse({
          expense: null,
          valid: false,
          confidence: 0,
          error: "Couldn't understand the input",
        }),
      );
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      const result = await sw.parseSentence({ input: 'gibberish' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Couldn't understand the input");
    });

    it('getMainData calls /get_main_data with query params', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({}));
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      await sw.getMainData({ noExpenses: true, limit: 50 });
      const [url] = fetchImpl.mock.calls[0]!;
      expect(url).toContain('/get_main_data');
      expect(url).toContain('no_expenses=1');
      expect(url).toContain('limit=50');
    });
  });

  describe('rawRequest escape hatch', () => {
    it('GET delegates to the http client and returns parsed body', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ foo: 'bar' }));
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      const result = await sw.rawRequest<{ foo: string }>(
        'GET',
        '/get_undocumented',
      );
      expect(result).toEqual({ foo: 'bar' });
      const [url] = fetchImpl.mock.calls[0]!;
      expect(url).toContain('/get_undocumented');
    });

    it('POST sends body and forwards options', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ id: 1 }));
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      await sw.rawRequest('POST', '/some_action', {
        body: { someParam: 'value', flag: true },
      });
      const [, init] = fetchImpl.mock.calls[0]!;
      const body = (init as RequestInit).body as string;
      expect(body).toContain('some_param=value');
      expect(body).toContain('flag=1');
    });

    it('respects unwrapKey when supplied', async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ thing: { id: 42 } }),
      );
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      const result = await sw.rawRequest<{ id: number }>(
        'GET',
        '/get_thing',
        { unwrapKey: 'thing' },
      );
      expect(result).toEqual({ id: 42 });
    });
  });

  describe('static auth helpers', () => {
    it('createAuthorizationUrl returns url, state, and codeVerifier', async () => {
      const result = await Splitwise.createAuthorizationUrl({
        clientId: 'my-client',
        redirectUri: 'http://localhost:3000/cb',
      });
      expect(result.url).toContain('client_id=my-client');
      expect(result.url).toContain('code_challenge_method=S256');
      expect(result.state).toBeTruthy();
      expect(result.codeVerifier).toBeTruthy();
    });

    it('fromAuthorizationCode exchanges code and returns a Splitwise instance', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.includes('/oauth/token')) {
          return jsonResponse({
            access_token: 'exchanged-token',
            token_type: 'bearer',
          });
        }
        return jsonResponse({ user: { id: 1, first_name: 'X', last_name: 'Y' } });
      });
      const sw = await Splitwise.fromAuthorizationCode(
        {
          clientId: 'c',
          clientSecret: 's',
          code: 'abc',
          codeVerifier: 'v',
          redirectUri: 'http://localhost/cb',
        },
        { fetch: fetchImpl as unknown as typeof fetch },
      );
      expect(sw).toBeInstanceOf(Splitwise);
      await sw.users.getCurrent();
      const apiCall = fetchImpl.mock.calls[1]!;
      const headers = (apiCall[1] as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer exchanged-token');
    });
  });
});
