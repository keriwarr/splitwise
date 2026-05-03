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
import {
  HttpClient,
  type Hooks,
  type RequestOptions,
  type RequestOverrides,
} from './http.js';
import { SDK_VERSION } from './version.js';
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
  /**
   * Lifecycle hooks for observability (request/response/error). Hooks are
   * called synchronously per attempt; thrown errors are caught and logged.
   */
  hooks?: Hooks;
  /**
   * Identifies the calling application in the User-Agent header. Helps the
   * Splitwise team trace requests back to a specific app/plugin if you need
   * support; useful for telemetry on your own end too.
   */
  appInfo?: AppInfo;
}

/** Identifies a calling application; concatenated into the User-Agent header. */
export interface AppInfo {
  name: string;
  version?: string;
  url?: string;
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
  'hooks',
  'appInfo',
]);

function buildUserAgent(appInfo: AppInfo | undefined): string {
  const base = `splitwise-node/${SDK_VERSION}`;
  if (appInfo === undefined) return base;
  let app = appInfo.name;
  if (appInfo.version !== undefined) app += `/${appInfo.version}`;
  if (appInfo.url !== undefined) app += ` (${appInfo.url})`;
  return `${base} ${app}`;
}

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
  /**
   * Holds an in-flight token fetch so concurrent first-call requests share a
   * single network call instead of stampeding the OAuth endpoint.
   */
  private inFlightTokenFetch: Promise<OAuthToken> | null = null;

  constructor(config: SplitwiseConfig) {
    validateConfig(config);

    this.config = config;
    this.fetchImpl = config.fetch;

    this.http = new HttpClient({
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      getAccessToken: () => this.getAccessToken(),
      userAgent: buildUserAgent(config.appInfo),
      ...(this.fetchImpl !== undefined && { fetch: this.fetchImpl }),
      ...(config.timeout !== undefined && { timeout: config.timeout }),
      ...(config.maxRetries !== undefined && { maxRetries: config.maxRetries }),
      ...(config.logger !== undefined && { logger: config.logger }),
      ...(config.logLevel !== undefined && { logLevel: config.logLevel }),
      ...(config.hooks !== undefined && { hooks: config.hooks }),
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
  async test(overrides?: RequestOverrides): Promise<{
    clientId: number;
    token: { accessToken: string; tokenType: string };
    requestUrl: string;
    params: Record<string, unknown>;
  }> {
    return this.http.get('/test', overrides);
  }

  /** Parse a natural-language expense description (e.g. "I owe Bob $10"). */
  async parseSentence(
    params: ParseSentenceParams,
    overrides?: RequestOverrides,
  ): Promise<ParseSentenceResponse> {
    return this.http.post<ParseSentenceResponse>('/parse_sentence', {
      body: { ...params },
      ...overrides,
    });
  }

  /** Bulk fetch of user, groups, friends, currencies, categories, etc. */
  async getMainData(
    params?: GetMainDataParams,
    overrides?: RequestOverrides,
  ): Promise<unknown> {
    return this.http.get<unknown>('/get_main_data', {
      ...(params !== undefined && { query: { ...params } }),
      ...overrides,
    });
  }

  /**
   * Escape hatch for endpoints not (yet) covered by the typed resource API.
   *
   * Goes through the same pipeline as the typed methods (auth, retries,
   * camelCase conversion, hooks, error mapping), so you don't lose those
   * niceties — but you have to know the path/shape yourself.
   *
   * @example
   * ```ts
   * const result = await sw.rawRequest<MyShape>(
   *   'GET',
   *   '/some_undocumented_endpoint',
   *   { query: { limit: 10 } },
   * );
   * ```
   */
  async rawRequest<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    switch (method) {
      case 'GET':
        return this.http.get<T>(path, options);
      case 'POST':
        return this.http.post<T>(path, options);
      case 'PUT':
        return this.http.put<T>(path, options);
      case 'DELETE':
        return this.http.delete<T>(path, options);
    }
  }

  // ---------------------------------------------------------------------------
  // Token management
  // ---------------------------------------------------------------------------

  /**
   * Returns a valid access token, fetching one via Client Credentials if
   * necessary. Useful for callers who want to obtain a token once and persist
   * it across process restarts (then pass it back as `accessToken`).
   *
   * Concurrent calls share a single in-flight fetch (no thundering herd).
   */
  async getAccessToken(): Promise<string> {
    // A cached OAuthToken (set by fromAuthorizationCode or by a prior
    // Client Credentials fetch) takes priority over a static
    // config.accessToken because it may carry expiry/refresh metadata.
    if (this.cachedToken !== null && !isTokenExpired(this.cachedToken)) {
      return this.cachedToken.accessToken;
    }

    if (this.config.accessToken !== undefined) {
      return this.config.accessToken;
    }

    // If another caller already kicked off a token fetch, wait on theirs
    // instead of starting a second one.
    if (this.inFlightTokenFetch !== null) {
      const token = await this.inFlightTokenFetch;
      return token.accessToken;
    }

    // We've already verified consumerKey and consumerSecret in validateConfig
    // when accessToken is absent.
    const fetchOptions = {
      ...(this.fetchImpl !== undefined && { fetch: this.fetchImpl }),
      ...(this.config.timeout !== undefined && { timeout: this.config.timeout }),
      ...(this.config.maxRetries !== undefined && {
        maxRetries: this.config.maxRetries,
      }),
    };
    this.inFlightTokenFetch = fetchClientCredentialsToken(
      {
        clientId: this.config.consumerKey as string,
        clientSecret: this.config.consumerSecret as string,
      },
      fetchOptions,
    );
    try {
      const token = await this.inFlightTokenFetch;
      this.cachedToken = token;
      return token.accessToken;
    } finally {
      this.inFlightTokenFetch = null;
    }
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
   *
   * The full OAuthToken (including `expiresAt` and `refreshToken` if Splitwise
   * provides them) is stored on the client; you can read it back via
   * `sw.getOAuthToken()` to persist for later use.
   */
  static async fromAuthorizationCode(
    params: ExchangeCodeParams,
    config?: Omit<
      SplitwiseConfig,
      'consumerKey' | 'consumerSecret' | 'accessToken'
    >,
  ): Promise<Splitwise> {
    const fetchImpl = config?.fetch;
    const tokenOptions = {
      ...(fetchImpl !== undefined && { fetch: fetchImpl }),
      ...(config?.timeout !== undefined && { timeout: config.timeout }),
      ...(config?.maxRetries !== undefined && { maxRetries: config.maxRetries }),
    };
    const token = await exchangeAuthorizationCode(params, tokenOptions);
    const sw = new Splitwise({
      ...config,
      // Pass the access token so validateConfig accepts the construction;
      // the cached OAuthToken below preserves expiry/refresh metadata that
      // a bare `accessToken` config option can't.
      accessToken: token.accessToken,
    });
    sw.cachedToken = token;
    return sw;
  }

  /**
   * Returns the cached OAuthToken if one was obtained via Client Credentials
   * or `fromAuthorizationCode`, or undefined if the client was constructed
   * with a bare `accessToken` (no expiry metadata to share).
   *
   * Useful for persisting the token across process restarts:
   *
   * ```ts
   * const token = sw.getOAuthToken();
   * if (token !== undefined) {
   *   await persist(token);  // store accessToken + expiresAt + refreshToken
   * }
   * ```
   */
  getOAuthToken(): OAuthToken | undefined {
    return this.cachedToken ?? undefined;
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

  // Reject empty strings explicitly -- they would otherwise pass the
  // !== undefined check and produce a useless `Bearer ` header at request time.
  if (config.accessToken !== undefined && config.accessToken.length === 0) {
    throw new TypeError('Splitwise: accessToken cannot be an empty string');
  }
  if (config.consumerKey !== undefined && config.consumerKey.length === 0) {
    throw new TypeError('Splitwise: consumerKey cannot be an empty string');
  }
  if (config.consumerSecret !== undefined && config.consumerSecret.length === 0) {
    throw new TypeError('Splitwise: consumerSecret cannot be an empty string');
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
