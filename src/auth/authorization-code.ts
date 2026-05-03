/**
 * OAuth 2.0 Authorization Code grant with PKCE for Splitwise.
 *
 * Two-step flow:
 *   1. `createAuthorizationUrl` builds the consent URL and generates the
 *      `state` and `code_verifier` the caller must persist.
 *   2. After the user approves and Splitwise redirects back with `?code=...`,
 *      `exchangeAuthorizationCode` swaps that code for an access token.
 *
 * PKCE (RFC 7636) is mandatory here. The verifier never leaves the caller
 * until step 2, which protects against authorization code interception.
 */

import { DEFAULT_AUTHORIZE_URL, postTokenRequest } from './internal.js';
import type {
  AuthorizationUrlParams,
  AuthorizationUrlResult,
  ExchangeCodeParams,
  OAuthToken,
} from './types.js';

/**
 * URL-safe base64 per RFC 4648 §5: replace +/= with -_ and strip padding.
 */
function base64urlEncode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(digest));
}

export async function createAuthorizationUrl(
  params: AuthorizationUrlParams,
  options: { authorizeUrl?: string } = {},
): Promise<AuthorizationUrlResult> {
  const authorizeUrl = options.authorizeUrl ?? DEFAULT_AUTHORIZE_URL;

  // 32 bytes -> 43-char base64url string, comfortably inside RFC 7636's 43-128.
  const state = params.state ?? randomBase64Url(32);
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const url = new URL(authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (params.scope !== undefined) {
    url.searchParams.set('scope', params.scope);
  }

  return {
    url: url.toString(),
    state,
    codeVerifier,
  };
}

export async function exchangeAuthorizationCode(
  params: ExchangeCodeParams,
  options: { fetch?: typeof fetch; tokenUrl?: string } = {},
): Promise<OAuthToken> {
  return postTokenRequest(
    {
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code_verifier: params.codeVerifier,
    },
    options,
  );
}
