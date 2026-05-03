/**
 * Type definitions for Splitwise OAuth 2.0 flows.
 *
 * Splitwise supports two grants:
 *  - Client Credentials: server-to-server, uses your app's client_id/secret.
 *  - Authorization Code with PKCE: user-facing, redirects through Splitwise's
 *    consent screen and returns an access token tied to that user.
 */

export interface OAuthToken {
  accessToken: string;
  tokenType: string;
  /** Date.now() ms; undefined if no expiry was returned. */
  expiresAt?: number;
  /** Splitwise doesn't currently issue refresh tokens; reserved for parity. */
  refreshToken?: string;
}

export interface AuthorizationUrlParams {
  clientId: string;
  redirectUri: string;
  scope?: string;
  /** If omitted, the SDK generates a cryptographically random value. */
  state?: string;
}

export interface AuthorizationUrlResult {
  url: string;
  /** App must store this to verify on the OAuth callback. */
  state: string;
  /** App must store this to send when exchanging the authorization code. */
  codeVerifier: string;
}

export interface ExchangeCodeParams {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface ClientCredentialsParams {
  clientId: string;
  clientSecret: string;
}
