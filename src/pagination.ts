/**
 * Pagination helper for Splitwise list endpoints.
 *
 * Splitwise uses a simple `limit`/`offset` scheme with no continuation tokens,
 * so a "page" is exhausted when the server returns fewer rows than requested
 * (or none at all). `PagedResult` wraps that loop in a value that is:
 *   - awaitable: `await result` resolves to the first page's array
 *   - async-iterable: `for await (const item of result)` yields every item
 *   - page-iterable: `for await (const page of result.byPage())` yields arrays
 *
 * The first page fetched via `await` is cached, so repeated awaits don't
 * re-hit the network. Iteration always starts a fresh sequence from the
 * configured offset to keep the iterator implementation independent.
 */

import type { HttpClient } from './http.js';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export interface PagedResultOptions {
  /** Page size; default 20. */
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
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const startOffset = options?.offset ?? DEFAULT_OFFSET;
  const extraQuery = options?.query ?? {};

  const fetchPage = (offset: number): Promise<T[]> =>
    http.get<T[]>(path, {
      query: { ...extraQuery, limit, offset },
      unwrapKey,
    });

  // Cache the first page so repeated `await result` calls don't re-fetch.
  let firstPagePromise: Promise<T[]> | null = null;
  const getFirstPage = (): Promise<T[]> => {
    if (firstPagePromise === null) {
      firstPagePromise = fetchPage(startOffset);
    }
    return firstPagePromise;
  };

  async function* pageIterator(): AsyncGenerator<T[], void, void> {
    // Iteration is always independent of any cached first-page await: each
    // iteration sequence fetches its own pages starting from `startOffset`.
    let offset = startOffset;
    while (true) {
      const page = await fetchPage(offset);

      if (page.length > 0) {
        yield page;
      }

      // Stop when the server returns a short or empty page; in either case
      // there's nothing more to fetch.
      if (page.length < limit) return;
      offset += limit;
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
