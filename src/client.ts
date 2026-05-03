/**
 * Splitwise SDK v2 client.
 *
 * Resource-namespaced client for the Splitwise API. Supports two OAuth flows
 * (Client Credentials for app-owner access, Authorization Code + PKCE for
 * end-user access), automatic retries, and zero runtime dependencies.
 *
 * @example
 * ```typescript
 * // Client Credentials (app owner's data)
 * const sw = new Splitwise({ consumerKey: '...', consumerSecret: '...' });
 * const expenses = await sw.expenses.list({ groupId: 123 });
 *
 * // Authorization Code with PKCE (end-user data)
 * const auth = await Splitwise.createAuthorizationUrl({
 *   clientId: '...', redirectUri: 'http://localhost:3000/callback',
 * });
 * // ...redirect user to auth.url, capture `code` from callback...
 * const sw = await Splitwise.fromAuthorizationCode({
 *   clientId: '...', clientSecret: '...',
 *   code, codeVerifier: auth.codeVerifier,
 *   redirectUri: 'http://localhost:3000/callback',
 * });
 * ```
 */

import {
  createAuthorizationUrl,
  exchangeAuthorizationCode,
} from './auth/authorization-code.js';
import { fetchClientCredentialsToken } from './auth/client-credentials.js';
import type {
  AuthorizationUrlParams,
  AuthorizationUrlResult,
  ExchangeCodeParams,
  OAuthToken,
} from './auth/types.js';
import { HttpClient } from './http.js';
import { Categories } from './resources/categories.js';
import { Comments } from './resources/comments.js';
import { Currencies } from './resources/currencies.js';
import { Expenses } from './resources/expenses.js';
import { Friends } from './resources/friends.js';
import { Groups } from './resources/groups.js';
import { Notifications } from './resources/notifications.js';
import { Users } from './resources/users.js';
import type {
  GetMainDataParams,
  Logger,
  LogLevel,
  ParseSentenceParams,
  ParseSentenceResponse,
} from './types.js';

const DEFAULT_BASE_URL = 'https://secure.splitwise.com/api/v3.0';

/** Configuration accepted by the Splitwise constructor. */
export interface SplitwiseConfig {
  /** OAuth consumer key. Required when accessToken is not provided. */
  consumerKey?: string;
  /** OAuth consumer secret. Required when accessToken is not provided. */
  consumerSecret?: string;
  /** Pre-obtained access token. If set, the client skips the OAuth flow. */
  accessToken?: string;
  /** Override the API base URL (useful for testing). */
  baseUrl?: string;
  /** Maximum automatic retries for transient failures. Default 2. */
  maxRetries?: number;
  /** Per-request timeout in ms. Default 30000. */
  timeout?: number;
  /** Inject a custom logger; the SDK never calls console.* directly. */
  logger?: Logger;
  /** Filter logs at or below this level. Default 'none'. */
  logLevel?: LogLevel;
  /** Inject a custom fetch (useful for testing). */
  fetch?: typeof fetch;
}

const ALLOWED_CONFIG_KEYS: ReadonlySet<keyof SplitwiseConfig> = new Set([
  'consumerKey',
  'consumerSecret',
  'accessToken',
  'baseUrl',
  'maxRetries',
  'timeout',
  'logger',
  'logLevel',
  'fetch',
]);

export class Splitwise {
  readonly expenses: Expenses;
  readonly groups: Groups;
  readonly users: Users;
  readonly friends: Friends;
  readonly comments: Comments;
  readonly notifications: Notifications;
  readonly currencies: Currencies;
  readonly categories: Categories;

  private readonly http: HttpClient;
  private readonly config: SplitwiseConfig;
  private readonly fetchImpl: typeof fetch | undefined;
  private cachedToken: OAuthToken | null = null;

  constructor(config: SplitwiseConfig) {
    validateConfig(config);

    this.config = config;
    this.fetchImpl = config.fetch;

    this.http = new HttpClient({
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      getAccessToken: () => this.getAccessToken(),
      ...(this.fetchImpl !== undefined && { fetch: this.fetchImpl }),
      ...(config.timeout !== undefined && { timeout: config.timeout }),
      ...(config.maxRetries !== undefined && { maxRetries: config.maxRetries }),
      ...(config.logger !== undefined && { logger: config.logger }),
      ...(config.logLevel !== undefined && { logLevel: config.logLevel }),
    });

    this.expenses = new Expenses(this.http);
    this.groups = new Groups(this.http);
    this.users = new Users(this.http);
    this.friends = new Friends(this.http);
    this.comments = new Comments(this.http);
    this.notifications = new Notifications(this.http);
    this.currencies = new Currencies(this.http);
    this.categories = new Categories(this.http);
  }

  // ---------------------------------------------------------------------------
  // Top-level utility methods (not natural fits for any resource)
  // ---------------------------------------------------------------------------

  /**
   * Returns identifying info about the authenticated client. Useful as a
   * smoke test ("am I authenticated?") and for confirming which app/token
   * the SDK is using.
   *
   * Despite the name, the endpoint is closer to a `whoami` than a generic
   * health check.
   */
  async test(): Promise<{
    clientId: number;
    token: { accessToken: string; tokenType: string };
    requestUrl: string;
    params: Record<string, unknown>;
  }> {
    return this.http.get('/test');
  }

  /** Parse a natural-language expense description (e.g. "I owe Bob $10"). */
  async parseSentence(
    params: ParseSentenceParams,
  ): Promise<ParseSentenceResponse> {
    return this.http.post<ParseSentenceResponse>('/parse_sentence', {
      body: { ...params },
    });
  }

  /** Bulk fetch of user, groups, friends, currencies, categories, etc. */
  async getMainData(params?: GetMainDataParams): Promise<unknown> {
    return this.http.get<unknown>('/get_main_data', {
      ...(params !== undefined && { query: { ...params } }),
    });
  }

  // ---------------------------------------------------------------------------
  // Token management
  // ---------------------------------------------------------------------------

  /**
   * Returns a valid access token, fetching one via Client Credentials if
   * necessary. Useful for callers who want to obtain a token once and persist
   * it across process restarts (then pass it back as `accessToken`).
   */
  async getAccessToken(): Promise<string> {
    if (this.config.accessToken !== undefined) {
      return this.config.accessToken;
    }

    if (this.cachedToken !== null && !isTokenExpired(this.cachedToken)) {
      return this.cachedToken.accessToken;
    }

    // We've already verified consumerKey and consumerSecret in validateConfig
    // when accessToken is absent.
    const token = await fetchClientCredentialsToken(
      {
        clientId: this.config.consumerKey as string,
        clientSecret: this.config.consumerSecret as string,
      },
      this.fetchImpl !== undefined ? { fetch: this.fetchImpl } : undefined,
    );

    this.cachedToken = token;
    return token.accessToken;
  }

  // ---------------------------------------------------------------------------
  // Static auth helpers (Authorization Code + PKCE flow)
  // ---------------------------------------------------------------------------

  /**
   * Generate an authorization URL for the OAuth Authorization Code + PKCE flow.
   * Returns the URL plus the `state` and `codeVerifier` values your application
   * must persist (e.g. in a session) to complete the exchange.
   */
  static async createAuthorizationUrl(
    params: AuthorizationUrlParams,
  ): Promise<AuthorizationUrlResult> {
    return createAuthorizationUrl(params);
  }

  /**
   * Exchange an authorization code for an access token, then return a fully
   * configured Splitwise client using that token.
   */
  static async fromAuthorizationCode(
    params: ExchangeCodeParams,
    config?: Omit<
      SplitwiseConfig,
      'consumerKey' | 'consumerSecret' | 'accessToken'
    >,
  ): Promise<Splitwise> {
    const fetchImpl = config?.fetch;
    const token = await exchangeAuthorizationCode(
      params,
      fetchImpl !== undefined ? { fetch: fetchImpl } : undefined,
    );
    return new Splitwise({
      ...config,
      accessToken: token.accessToken,
    });
  }
}

// v1 supported these as constructor defaults; v2 dropped them. Surface a
// helpful error rather than the generic "unknown option" message.
const V1_DROPPED_KEYS = new Set([
  'group_id',
  'user_id',
  'expense_id',
  'friend_id',
]);

function validateConfig(config: SplitwiseConfig): void {
  if (config === null || typeof config !== 'object') {
    throw new TypeError('Splitwise config must be an object');
  }

  for (const key of Object.keys(config)) {
    if (V1_DROPPED_KEYS.has(key)) {
      throw new TypeError(
        `Splitwise v2 no longer supports the "${key}" default-ID config option from v1. ` +
          `Pass IDs explicitly to each method instead (e.g. sw.expenses.list({ groupId: 123 })).`,
      );
    }
    if (!ALLOWED_CONFIG_KEYS.has(key as keyof SplitwiseConfig)) {
      throw new TypeError(`Unknown Splitwise config option: "${key}"`);
    }
  }

  const hasToken = config.accessToken !== undefined;
  const hasCreds =
    config.consumerKey !== undefined && config.consumerSecret !== undefined;

  if (!hasToken && !hasCreds) {
    throw new TypeError(
      'Splitwise requires either an accessToken, or both consumerKey and consumerSecret',
    );
  }
}

function isTokenExpired(token: OAuthToken): boolean {
  if (token.expiresAt === undefined) return false;
  // Refresh 60s early to avoid using a token that expires mid-request
  return Date.now() >= token.expiresAt - 60_000;
}
