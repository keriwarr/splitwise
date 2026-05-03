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
  SplitwiseConnectionError,
  SplitwiseConstraintError,
  createApiError,
} from './errors.js';
import { flattenParams, keysToCamelCase, keysToSnakeCase } from './params.js';
import { defaultShouldRetry, withRetry } from './retry.js';
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
  /** Optional User-Agent string. */
  userAgent?: string;
  /** Lifecycle hooks; see `Hooks` interface for the contract. */
  hooks?: Hooks;
}

/**
 * Lifecycle hooks for observability and side-effects. Inspired by Stripe's
 * event emitter (`stripe.on('request', cb)`), but expressed as a plain
 * options bag so consumers don't need to import an event-emitter API.
 *
 * Hooks are called synchronously (not awaited). Returning a Promise has no
 * effect on the request flow -- if a hook needs to do async work, it should
 * fire-and-forget, and any thrown error is caught and ignored so that hook
 * misbehavior doesn't break SDK calls.
 */
export interface Hooks {
  /** Called before each HTTP request leaves the client. */
  onRequest?: (event: RequestEvent) => void;
  /** Called for each successful response (any 2xx, even with embedded errors). */
  onResponse?: (event: ResponseEvent) => void;
  /**
   * Called for every error that the SDK is about to throw. Includes both
   * transport failures (connection, timeout, abort) and API errors. Fires
   * once per attempt, so retried requests fire the hook multiple times.
   */
  onError?: (event: ErrorEvent) => void;
}

export interface RequestEvent {
  method: string;
  url: string;
  /** The Authorization header is replaced with "Bearer [REDACTED]" for safety. */
  headers: Record<string, string>;
  /** 1-indexed; >1 indicates a retry. */
  attempt: number;
}

export interface ResponseEvent {
  method: string;
  url: string;
  status: number;
  /** Response headers (lowercased keys). */
  headers: Record<string, string>;
  /** Wall-clock ms from request dispatch to response received. */
  durationMs: number;
  attempt: number;
}

export interface ErrorEvent {
  method: string;
  url: string;
  error: unknown;
  durationMs: number;
  attempt: number;
}

/**
 * Per-request overrides exposed publicly to consumers of the SDK. The same
 * options bag is accepted by every resource method (as the second argument)
 * and by `sw.rawRequest()`. Internal-only options live on `RequestOptions`.
 */
export interface RequestOverrides {
  /** Cancel the request via an AbortSignal. */
  signal?: AbortSignal;
  /** Override the client's per-request timeout (ms) for this call. */
  timeout?: number;
  /** Override the client's `maxRetries` for this call (0 disables retry). */
  maxRetries?: number;
  /** Override the base URL for this call (rare; useful for testing). */
  baseUrl?: string;
}

export interface RequestOptions extends RequestOverrides {
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
    // Blobs can't go in a URL query string. Skip them rather than emitting
    // "[object Blob]"; if the caller wanted a file upload they should pass it
    // in the body, not the query.
    if (value instanceof Blob) continue;
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
 * Walks an object/array tree to detect any Blob value (e.g. a file upload).
 * Used by the request layer to decide between form-urlencoded and multipart.
 */
function containsBlob(value: unknown): boolean {
  if (value instanceof Blob) return true;
  if (Array.isArray(value)) return value.some(containsBlob);
  if (isPlainObject(value)) return Object.values(value).some(containsBlob);
  return false;
}

/**
 * Builds a multipart/form-data FormData from a request body. Uses the same
 * flattening pass as the form-urlencoded path so nested Blobs (e.g. an array
 * of receipts) ride correctly under their flattened keys.
 *
 * File-class Blobs preserve their `name` property; bare Blobs get a generic
 * "blob" filename so the API doesn't reject them as missing-filename.
 */
function buildMultipartBody(body: Record<string, unknown>): FormData {
  const form = new FormData();
  const flat = flattenParams(body);
  for (const [key, value] of Object.entries(flat)) {
    if (value instanceof Blob) {
      const filename =
        // File extends Blob and has its own `name` property.
        (value as Blob & { name?: string }).name ?? defaultBlobFilename(value);
      form.append(key, value, filename);
    } else {
      form.append(key, String(value));
    }
  }
  return form;
}

/** Pick a sensible default filename for a bare Blob based on its MIME type. */
function defaultBlobFilename(blob: Blob): string {
  const subtype = blob.type.split('/')[1]?.split(';')[0]?.trim();
  if (subtype !== undefined && subtype.length > 0) {
    return `blob.${subtype}`;
  }
  return 'blob';
}

/** Replace the Authorization header's value with a placeholder for safe logging. */
function redactAuthHeader(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...headers };
  if ('Authorization' in out) {
    out['Authorization'] = 'Bearer [REDACTED]';
  }
  return out;
}

/** Convert a Headers instance to a plain object with lowercased keys. */
function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
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
  private readonly userAgent: string | undefined;
  private readonly hooks: Hooks;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.getAccessToken = config.getAccessToken;
    // Bind to globalThis so the default fetch keeps the right `this`.
    this.fetchImpl =
      config.fetch ?? ((globalThis as { fetch: typeof fetch }).fetch.bind(globalThis));
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.logger = createInternalLogger(config.logger, config.logLevel ?? 'none');
    this.userAgent = config.userAgent;
    this.hooks = config.hooks ?? {};
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
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const callerSignal = options.signal;
    // Don't burn through retries if the caller has already given up.
    const shouldRetry = (ctx: Parameters<typeof defaultShouldRetry>[0]): boolean => {
      if (callerSignal?.aborted === true) return false;
      return defaultShouldRetry(ctx);
    };
    let attempt = 0;
    return withRetry(
      () => {
        attempt += 1;
        return this.requestOnce<T>(method, path, options, attempt);
      },
      { maxRetries },
      shouldRetry,
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
    attempt: number,
  ): Promise<T> {
    const baseUrl = options.baseUrl ?? this.baseUrl;
    const timeout = options.timeout ?? this.timeout;
    const queryString =
      options.query !== undefined ? buildQueryString(options.query) : '';
    const url = `${joinUrl(baseUrl, path)}${queryString}`;

    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    if (this.userAgent !== undefined) {
      headers['User-Agent'] = this.userAgent;
    }

    let body: string | FormData | undefined;
    if (options.body !== undefined && method !== 'GET') {
      const useForm = options.formEncoded !== false;
      if (useForm && containsBlob(options.body)) {
        // The body has a file (e.g. an expense receipt). Send as multipart so
        // fetch can include the binary payload. Don't set Content-Type — fetch
        // attaches it automatically with the boundary.
        body = buildMultipartBody(options.body);
      } else if (useForm) {
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
    this.fireHook('onRequest', () => ({
      method,
      url,
      headers: redactAuthHeader(headers),
      attempt,
    }));

    // Combine the timeout-driven AbortController with any caller-supplied
    // signal. We can't use AbortSignal.any() because it's Node 20+; instead,
    // wire up a manual listener that aborts our controller when the caller
    // signal fires.
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, timeout);
    const callerSignal = options.signal;
    let abortListenerCleanup: (() => void) | undefined;
    if (callerSignal !== undefined) {
      if (callerSignal.aborted) {
        controller.abort();
      } else {
        const onAbort = (): void => {
          controller.abort();
        };
        callerSignal.addEventListener('abort', onAbort);
        abortListenerCleanup = (): void => {
          callerSignal.removeEventListener('abort', onAbort);
        };
      }
    }

    const startedAt = Date.now();
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
      let wrapped: SplitwiseConnectionError;
      // AbortError fires both on timeout and on caller-initiated abort. We
      // distinguish them by checking which side actually pulled the trigger.
      if (err.name === 'AbortError') {
        wrapped =
          callerSignal?.aborted === true
            ? new SplitwiseConnectionError('Request aborted by caller', err)
            : new SplitwiseConnectionError(
                `Request timed out after ${timeout}ms`,
                err,
              );
      } else {
        wrapped = new SplitwiseConnectionError(
          err.message || 'Network request failed',
          err,
        );
      }
      this.fireHook('onError', () => ({
        method,
        url,
        error: wrapped,
        durationMs: Date.now() - startedAt,
        attempt,
      }));
      throw wrapped;
    } finally {
      clearTimeout(timeoutHandle);
      abortListenerCleanup?.();
    }

    const durationMs = Date.now() - startedAt;
    this.logger.debug(`${method} ${url} -> ${response.status}`);
    this.fireHook('onResponse', () => ({
      method,
      url,
      status: response.status,
      headers: headersToObject(response.headers),
      durationMs,
      attempt,
    }));

    try {
      return await this.handleResponse<T>(response, options.unwrapKey);
    } catch (error) {
      this.fireHook('onError', () => ({
        method,
        url,
        error,
        durationMs: Date.now() - startedAt,
        attempt,
      }));
      throw error;
    }
  }

  /**
   * Calls a hook if registered. Wraps the event-builder in a function so we
   * skip the work entirely when no hook is registered. Catches synchronous
   * throws so misbehaving user code doesn't break the request.
   */
  private fireHook<K extends keyof Hooks>(
    name: K,
    buildEvent: () => Parameters<NonNullable<Hooks[K]>>[0],
  ): void {
    const hook = this.hooks[name];
    if (hook === undefined) return;
    try {
      // Type assertion needed because TS can't narrow the union of event types.
      (hook as (event: ReturnType<typeof buildEvent>) => void)(buildEvent());
    } catch (err) {
      this.logger.error(
        `${name} hook threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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

    // Splitwise's "destructive" endpoints (delete_*, undelete_*, addUser,
    // removeUser) and some create/update endpoints can return 200 with
    // success:false or a non-empty errors field when the operation can't
    // happen for a domain reason (e.g. deleting a friend with unsettled
    // debts). Surface these as a typed exception so callers can distinguish
    // "domain failure" from successful results without inspecting the body.
    if (isPlainObject(parsed)) {
      const embedded = extractErrorsFromBody(parsed);
      const explicitFailure = parsed['success'] === false;
      if (embedded !== null || explicitFailure) {
        const message =
          embedded?.message ??
          'Splitwise reported the operation as unsuccessful';
        const code = embedded?.code ?? 'success_false';
        throw new SplitwiseConstraintError(message, code, parsed);
      }
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
