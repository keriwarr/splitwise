import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthorizationUrl,
  exchangeAuthorizationCode,
} from '../../../src/auth/authorization-code.js';
import { SplitwiseAuthenticationError } from '../../../src/errors.js';

const TOKEN_URL = 'https://secure.splitwise.com/oauth/token';
const AUTHORIZE_URL = 'https://secure.splitwise.com/oauth/authorize';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Match the helper used in src/auth/authorization-code.ts. */
function base64urlEncode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(digest));
}

describe('createAuthorizationUrl', () => {
  it('builds a URL with all required PKCE and OAuth params', async () => {
    const result = await createAuthorizationUrl({
      clientId: 'my-client',
      redirectUri: 'https://example.test/cb',
      scope: 'read write',
    });

    const parsed = new URL(result.url);
    expect(parsed.origin + parsed.pathname).toBe(AUTHORIZE_URL);
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('my-client');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://example.test/cb',
    );
    expect(parsed.searchParams.get('state')).toBe(result.state);
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).not.toBeNull();
    expect(parsed.searchParams.get('scope')).toBe('read write');
  });

  it('omits the scope param when not provided', async () => {
    const result = await createAuthorizationUrl({
      clientId: 'id',
      redirectUri: 'https://example.test/cb',
    });

    const parsed = new URL(result.url);
    expect(parsed.searchParams.has('scope')).toBe(false);
  });

  it('uses a custom authorizeUrl when provided', async () => {
    const custom = 'https://example.test/authorize';
    const result = await createAuthorizationUrl(
      { clientId: 'id', redirectUri: 'https://example.test/cb' },
      { authorizeUrl: custom },
    );

    const parsed = new URL(result.url);
    expect(parsed.origin + parsed.pathname).toBe(custom);
  });

  it('generates a unique state of at least ~32 chars when not provided', async () => {
    const a = await createAuthorizationUrl({
      clientId: 'id',
      redirectUri: 'https://example.test/cb',
    });
    const b = await createAuthorizationUrl({
      clientId: 'id',
      redirectUri: 'https://example.test/cb',
    });

    expect(a.state).not.toBe(b.state);
    expect(a.state.length).toBeGreaterThanOrEqual(32);
    expect(b.state.length).toBeGreaterThanOrEqual(32);
  });

  it('uses the caller-provided state verbatim', async () => {
    const customState = 'my-explicit-state-value';
    const result = await createAuthorizationUrl({
      clientId: 'id',
      redirectUri: 'https://example.test/cb',
      state: customState,
    });

    expect(result.state).toBe(customState);
    expect(new URL(result.url).searchParams.get('state')).toBe(customState);
  });

  it('generates a unique codeVerifier 43-128 chars long', async () => {
    const a = await createAuthorizationUrl({
      clientId: 'id',
      redirectUri: 'https://example.test/cb',
    });
    const b = await createAuthorizationUrl({
      clientId: 'id',
      redirectUri: 'https://example.test/cb',
    });

    expect(a.codeVerifier).not.toBe(b.codeVerifier);
    expect(a.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(a.codeVerifier.length).toBeLessThanOrEqual(128);
  });

  it('emits code_challenge as base64url(SHA-256(verifier))', async () => {
    const result = await createAuthorizationUrl({
      clientId: 'id',
      redirectUri: 'https://example.test/cb',
    });

    const expected = await sha256Base64Url(result.codeVerifier);
    const actual = new URL(result.url).searchParams.get('code_challenge');
    expect(actual).toBe(expected);
  });

  it('produces base64url output free of +, /, and = characters', async () => {
    const result = await createAuthorizationUrl({
      clientId: 'id',
      redirectUri: 'https://example.test/cb',
    });

    const challenge = new URL(result.url).searchParams.get('code_challenge')!;
    for (const value of [result.state, result.codeVerifier, challenge]) {
      expect(value).not.toMatch(/[+/=]/);
    }
  });
});

describe('exchangeAuthorizationCode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the correct form body and returns the parsed token', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        access_token: 'tok_xyz',
        token_type: 'bearer',
        expires_in: 7200,
      }),
    );

    const token = await exchangeAuthorizationCode(
      {
        clientId: 'cid',
        clientSecret: 'csecret',
        code: 'auth-code',
        redirectUri: 'https://example.test/cb',
        codeVerifier: 'verifier-value',
      },
      { fetch: fetchMock as unknown as typeof fetch },
    );

    expect(token.accessToken).toBe('tok_xyz');
    expect(token.tokenType).toBe('bearer');
    expect(token.expiresAt).toBeDefined();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(TOKEN_URL);

    const reqInit = init as RequestInit;
    expect(reqInit.method).toBe('POST');
    const headers = reqInit.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    const body = new URLSearchParams(reqInit.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('redirect_uri')).toBe('https://example.test/cb');
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('client_secret')).toBe('csecret');
    expect(body.get('code_verifier')).toBe('verifier-value');
  });

  it('throws SplitwiseAuthenticationError on 401', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, { error: 'invalid_client' }),
    );

    const err = await exchangeAuthorizationCode(
      {
        clientId: 'cid',
        clientSecret: 'wrong',
        code: 'c',
        redirectUri: 'https://example.test/cb',
        codeVerifier: 'v',
      },
      { fetch: fetchMock as unknown as typeof fetch },
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SplitwiseAuthenticationError);
  });

  it('throws SplitwiseAuthenticationError on 400 invalid_grant', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, {
        error: 'invalid_grant',
        error_description: 'The provided authorization grant is invalid',
      }),
    );

    const err = await exchangeAuthorizationCode(
      {
        clientId: 'cid',
        clientSecret: 'csecret',
        code: 'expired',
        redirectUri: 'https://example.test/cb',
        codeVerifier: 'v',
      },
      { fetch: fetchMock as unknown as typeof fetch },
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SplitwiseAuthenticationError);
    expect((err as Error).message).toContain('authorization grant');
  });

  it('uses custom tokenUrl when provided', async () => {
    const customUrl = 'https://example.test/token';
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { access_token: 't', token_type: 'bearer' }),
    );

    await exchangeAuthorizationCode(
      {
        clientId: 'cid',
        clientSecret: 'csecret',
        code: 'c',
        redirectUri: 'https://example.test/cb',
        codeVerifier: 'v',
      },
      {
        fetch: fetchMock as unknown as typeof fetch,
        tokenUrl: customUrl,
      },
    );

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(customUrl);
  });
});
