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
    it('test() returns { success: true } on success', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));
      const sw = new Splitwise({ accessToken: 't', fetch: fetchImpl });
      const result = await sw.test();
      expect(result).toEqual({ success: true });
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
