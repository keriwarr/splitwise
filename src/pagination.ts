/**
 * Pagination helper for Splitwise list endpoints.
 *
 * Splitwise uses a simple `limit`/`offset` scheme with no continuation tokens,
 * so a "page" is exhausted when the server returns fewer rows than requested
 * (or none at all). `PagedResult` wraps that loop in a value that is:
 *   - awaitable: `await result` resolves to the first page's array (sends the
 *     user's `limit` as-is so the server's default applies when omitted)
 *   - async-iterable: `for await (const item of result)` yields every item
 *   - page-iterable: `for await (const page of result.byPage())` yields arrays
 *
 * Iteration needs a known page size to detect end-of-data, so when iterating
 * without an explicit `limit` the SDK uses `ITERATION_PAGE_SIZE` for batching.
 *
 * The first page fetched via `await` is cached, so repeated awaits don't
 * re-hit the network. Iteration always starts a fresh sequence from the
 * configured offset.
 */

import type { HttpClient, RequestOverrides } from './http.js';

const ITERATION_PAGE_SIZE = 100;
const DEFAULT_OFFSET = 0;

export interface PagedResultOptions extends RequestOverrides {
  /** Page size. If omitted, the server's default applies for `await result`,
   *  and `ITERATION_PAGE_SIZE` (100) applies for iteration. */
  limit?: number;
  /** Starting offset; default 0. */
  offset?: number;
  /** Other query params to send with each page request. */
  query?: Record<string, unknown>;
}

export interface PagedResult<T> extends AsyncIterable<T> {
  /** Awaitable: returns the first page array. */
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;

  /** Page-by-page iteration. */
  byPage(): AsyncIterable<T[]>;
}

export function createPagedResult<T>(
  http: HttpClient,
  path: string,
  unwrapKey: string,
  options?: PagedResultOptions,
): PagedResult<T> {
  const userLimit = options?.limit;
  const startOffset = options?.offset ?? DEFAULT_OFFSET;
  const extraQuery = options?.query ?? {};
  const overrides: RequestOverrides = {
    ...(options?.signal !== undefined && { signal: options.signal }),
    ...(options?.timeout !== undefined && { timeout: options.timeout }),
    ...(options?.maxRetries !== undefined && { maxRetries: options.maxRetries }),
    ...(options?.baseUrl !== undefined && { baseUrl: options.baseUrl }),
  };

  const fetchPage = (offset: number, limit: number | undefined): Promise<T[]> =>
    http.get<T[]>(path, {
      query: {
        ...extraQuery,
        ...(limit !== undefined && { limit }),
        offset,
      },
      unwrapKey,
      ...overrides,
    });

  // Cache the first page so repeated `await result` calls don't re-fetch.
  // The await path sends the user's limit as-is (no client-side default).
  let firstPagePromise: Promise<T[]> | null = null;
  const getFirstPage = (): Promise<T[]> => {
    if (firstPagePromise === null) {
      firstPagePromise = fetchPage(startOffset, userLimit);
    }
    return firstPagePromise;
  };

  async function* pageIterator(): AsyncGenerator<T[], void, void> {
    // Iteration needs a known page size to detect end-of-data.
    const pageSize = userLimit ?? ITERATION_PAGE_SIZE;
    let offset = startOffset;
    while (true) {
      const page = await fetchPage(offset, pageSize);

      if (page.length > 0) {
        yield page;
      }

      // Stop when the server returns a short or empty page; in either case
      // there's nothing more to fetch.
      if (page.length < pageSize) return;
      offset += pageSize;
    }
  }

  async function* itemIterator(): AsyncGenerator<T, void, void> {
    for await (const page of pageIterator()) {
      for (const item of page) {
        yield item;
      }
    }
  }

  return {
    then(onfulfilled, onrejected) {
      return getFirstPage().then(onfulfilled, onrejected);
    },
    byPage() {
      return { [Symbol.asyncIterator]: pageIterator };
    },
    [Symbol.asyncIterator]: itemIterator,
  };
}
