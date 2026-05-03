/**
 * HTTP client for the Splitwise API.
 *
 * Wraps `fetch` with:
 *  - bearer-token auth (token is fetched per request via `getAccessToken`)
 *  - automatic snake_case <-> camelCase conversion at the boundary
 *  - form-urlencoded request bodies (the Splitwise API's default) with an
 *    opt-in JSON path for new endpoints
 *  - typed error responses via `createApiError`
 *  - transparent retries with exponential backoff
 *  - request timeouts via AbortController
 */

import {
  SplitwiseApiError,
  SplitwiseConnectionError,
  createApiError,
} from './errors.js';
import { flattenParams, keysToCamelCase, keysToSnakeCase } from './params.js';
import { withRetry } from './retry.js';
import type { LogLevel, Logger } from './types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HttpClientConfig {
  baseUrl: string;
  getAccessToken: () => Promise<string>;
  fetch?: typeof fetch;
  /** Per-request timeout in ms. Default 30000. */
  timeout?: number;
  /** Maximum retries for transient failures. Default 2. */
  maxRetries?: number;
  logger?: Logger;
  /** Default 'none'. */
  logLevel?: LogLevel;
}

export interface RequestOptions {
  /** Query string parameters. Always sent in the URL regardless of method. */
  query?: Record<string, unknown>;
  /** Body, used for POST/PUT/DELETE. */
  body?: Record<string, unknown>;
  /**
   * If true (default), serialize body as form-urlencoded with flattenParams
   * (the Splitwise convention). If false, send as JSON with snake_case keys.
   */
  formEncoded?: boolean;
  /**
   * Property to extract from the parsed response, e.g. 'expenses' to get the
   * value of `{ expenses: [...] }`. If undefined, returns the full response.
   */
  unwrapKey?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

interface InternalLogger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

function createInternalLogger(
  logger: Logger | undefined,
  level: LogLevel,
): InternalLogger {
  const threshold = LOG_LEVEL_PRIORITY[level];
  const shouldLog = (target: LogLevel): boolean =>
    logger !== undefined && LOG_LEVEL_PRIORITY[target] <= threshold;

  return {
    debug(msg) {
      if (shouldLog('debug')) logger!.debug(msg);
    },
    info(msg) {
      if (shouldLog('info')) logger!.info(msg);
    },
    warn(msg) {
      if (shouldLog('warn')) logger!.warn(msg);
    },
    error(msg) {
      if (shouldLog('error')) logger!.error(msg);
    },
  };
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

function buildQueryString(query: Record<string, unknown>): string {
  // Use the same flattening/snake_case rules as the body so nested params and
  // booleans are encoded consistently.
  const flat = flattenParams(query);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(flat)) {
    params.append(key, String(value));
  }
  const str = params.toString();
  return str.length > 0 ? `?${str}` : '';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value)
  );
}

/**
 * Splitwise occasionally returns 200 with an `errors` field. This helper
 * extracts a human-readable message and detects whether there are errors at all.
 */
function extractErrorsFromBody(
  body: unknown,
): { message: string; code: string } | null {
  if (!isPlainObject(body)) return null;
  const errors = body['errors'];

  if (Array.isArray(errors) && errors.length > 0) {
    return {
      message: errors.filter((e) => typeof e === 'string').join('; ') || 'Request failed',
      code: 'errors',
    };
  }

  if (isPlainObject(errors)) {
    const messages: string[] = [];
    for (const value of Object.values(errors)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') messages.push(item);
        }
      } else if (typeof value === 'string') {
        messages.push(value);
      }
    }
    if (messages.length > 0) {
      return { message: messages.join('; '), code: 'errors' };
    }
  }

  if (typeof body['error'] === 'string') {
    return { message: body['error'] as string, code: 'error' };
  }

  if (typeof body['message'] === 'string') {
    return { message: body['message'] as string, code: 'error' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// HttpClient
// ---------------------------------------------------------------------------

export class HttpClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => Promise<string>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly logger: InternalLogger;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.getAccessToken = config.getAccessToken;
    // Bind to globalThis so the default fetch keeps the right `this`.
    this.fetchImpl =
      config.fetch ?? ((globalThis as { fetch: typeof fetch }).fetch.bind(globalThis));
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.logger = createInternalLogger(config.logger, config.logLevel ?? 'none');
  }

  get<T>(
    path: string,
    options?: Omit<RequestOptions, 'body' | 'formEncoded'>,
  ): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  put<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, options);
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    return withRetry(
      () => this.requestOnce<T>(method, path, options),
      { maxRetries: this.maxRetries },
    ).catch((error: unknown) => {
      if (error instanceof Error) {
        this.logger.error(`${method} ${path} failed: ${error.message}`);
      }
      throw error;
    });
  }

  private async requestOnce<T>(
    method: string,
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    const queryString =
      options.query !== undefined ? buildQueryString(options.query) : '';
    const url = `${joinUrl(this.baseUrl, path)}${queryString}`;

    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };

    let body: string | undefined;
    if (options.body !== undefined && method !== 'GET') {
      const useForm = options.formEncoded !== false;
      if (useForm) {
        const flat = flattenParams(options.body);
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(flat)) {
          params.append(key, String(value));
        }
        body = params.toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        body = JSON.stringify(keysToSnakeCase(options.body));
        headers['Content-Type'] = 'application/json';
      }
    }

    this.logger.debug(`${method} ${url}`);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, this.timeout);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (error) {
      const err = error as Error;
      // AbortError fires both on timeout and on caller-initiated abort; in
      // either case it surfaces to the user as a connection failure.
      if (err.name === 'AbortError') {
        throw new SplitwiseConnectionError(
          `Request timed out after ${this.timeout}ms`,
          err,
        );
      }
      throw new SplitwiseConnectionError(
        err.message || 'Network request failed',
        err,
      );
    } finally {
      clearTimeout(timeoutHandle);
    }

    this.logger.debug(`${method} ${url} -> ${response.status}`);

    return this.handleResponse<T>(response, options.unwrapKey);
  }

  private async handleResponse<T>(
    response: Response,
    unwrapKey: string | undefined,
  ): Promise<T> {
    const rawText = await response.text();
    let parsed: unknown = undefined;
    if (rawText.length > 0) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        // Non-JSON body. We keep `parsed` undefined and use the raw text in
        // any error messages below.
      }
    }

    if (!response.ok) {
      const fromBody = extractErrorsFromBody(parsed);
      const message =
        fromBody?.message ??
        `HTTP ${response.status} ${response.statusText || ''}`.trim();
      const code = fromBody?.code ?? `http_${response.status}`;
      throw createApiError(
        response.status,
        message,
        code,
        parsed ?? rawText,
        response.headers,
      );
    }

    // Splitwise sometimes returns 200 with an embedded `errors` field.
    const embedded = extractErrorsFromBody(parsed);
    if (embedded !== null) {
      throw new SplitwiseApiError(
        response.status,
        embedded.message,
        embedded.code,
        parsed,
      );
    }

    const camelCased = keysToCamelCase(parsed) as Record<string, unknown> | unknown;

    if (unwrapKey !== undefined) {
      if (isPlainObject(camelCased) && unwrapKey in camelCased) {
        return camelCased[unwrapKey] as T;
      }
      // Key not present — return undefined cast as T so callers expecting
      // optional fields don't get a runtime error.
      return undefined as T;
    }

    return camelCased as T;
  }
}
