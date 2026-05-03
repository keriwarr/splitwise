import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/http.js';
import { createPagedResult } from '../../src/pagination.js';

interface MockHttp {
  client: HttpClient;
  get: ReturnType<typeof vi.fn>;
}

/**
 * Builds a fake HttpClient whose `get` returns the next page from `pages` on
 * each call. The mock intentionally ignores the requested offset/limit so we
 * can assert on what was sent without coupling test fixtures to pagination
 * arithmetic.
 */
function makeMockHttp(pages: unknown[][]): MockHttp {
  let callIndex = 0;
  const get = vi.fn(async (_path: string, _options?: unknown) => {
    const page = pages[callIndex] ?? [];
    callIndex++;
    return page;
  });
  const client = { get } as unknown as HttpClient;
  return { client, get };
}

describe('createPagedResult', () => {
  it('does not call http.get when only constructed', () => {
    const { client, get } = makeMockHttp([[{ id: 1 }]]);
    createPagedResult(client, '/expenses', 'expenses');
    expect(get).not.toHaveBeenCalled();
  });

  it('await returns the first page', async () => {
    const page = [{ id: 1 }, { id: 2 }];
    const { client, get } = makeMockHttp([page]);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
    );
    await expect(result).resolves.toEqual(page);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('multiple awaits do not refetch the first page', async () => {
    const page = [{ id: 1 }];
    const { client, get } = makeMockHttp([page, page, page]);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
    );
    const first = await result;
    const second = await result;
    expect(first).toEqual(page);
    expect(second).toEqual(page);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('iterates all items across pages', async () => {
    const { client } = makeMockHttp([
      [{ id: 1 }, { id: 2 }],
      [{ id: 3 }, { id: 4 }],
      [{ id: 5 }],
    ]);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
      { limit: 2 },
    );
    const collected: { id: number }[] = [];
    for await (const item of result) {
      collected.push(item);
    }
    expect(collected).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ]);
  });

  it('stops on an empty page', async () => {
    const { client, get } = makeMockHttp([
      [{ id: 1 }, { id: 2 }],
      [],
    ]);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
      { limit: 2 },
    );
    const collected: { id: number }[] = [];
    for await (const item of result) {
      collected.push(item);
    }
    expect(collected).toEqual([{ id: 1 }, { id: 2 }]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('stops on a partial page (length < limit)', async () => {
    // Even though more pages exist in the fixture, a short page signals the
    // server has nothing more for us, so no further request should be made.
    const { client, get } = makeMockHttp([
      [{ id: 1 }, { id: 2 }],
      [{ id: 3 }],
      [{ id: 99 }, { id: 100 }],
    ]);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
      { limit: 2 },
    );
    const collected: { id: number }[] = [];
    for await (const item of result) {
      collected.push(item);
    }
    expect(collected).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('byPage() yields arrays', async () => {
    const pages = [
      [{ id: 1 }, { id: 2 }],
      [{ id: 3 }],
    ];
    const { client } = makeMockHttp(pages);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
      { limit: 2 },
    );
    const collected: { id: number }[][] = [];
    for await (const page of result.byPage()) {
      collected.push(page);
    }
    expect(collected).toEqual(pages);
  });

  it('passes custom limit and offset in the query', async () => {
    const { client, get } = makeMockHttp([[{ id: 1 }]]);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
      { limit: 50, offset: 100 },
    );
    await result;
    expect(get).toHaveBeenCalledWith('/expenses', {
      query: { limit: 50, offset: 100 },
      unwrapKey: 'expenses',
    });
  });

  it('merges extra query params with limit/offset', async () => {
    const { client, get } = makeMockHttp([[{ id: 1 }]]);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
      {
        limit: 10,
        offset: 0,
        query: { groupId: 42, datedAfter: '2026-01-01' },
      },
    );
    await result;
    expect(get).toHaveBeenCalledWith('/expenses', {
      query: {
        groupId: 42,
        datedAfter: '2026-01-01',
        limit: 10,
        offset: 0,
      },
      unwrapKey: 'expenses',
    });
  });

  it('iteration after await still yields all items', async () => {
    // The iterator must start its own sequence rather than skipping the
    // already-cached first page. We key the mock off the `offset` query param
    // so each request returns the appropriate page regardless of call order.
    const pagesByOffset: Record<number, { id: number }[]> = {
      0: [{ id: 1 }, { id: 2 }],
      2: [{ id: 3 }],
    };
    const get = vi.fn(async (_path: string, options?: unknown) => {
      const offset =
        (options as { query: { offset: number } }).query.offset;
      return pagesByOffset[offset] ?? [];
    });
    const client = { get } as unknown as HttpClient;
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
      { limit: 2 },
    );

    await result;

    const collected: { id: number }[] = [];
    for await (const item of result) {
      collected.push(item);
    }
    expect(collected).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('await without limit sends no limit (server default applies)', async () => {
    const { client, get } = makeMockHttp([[{ id: 1 }]]);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
    );
    await result;
    expect(get).toHaveBeenCalledWith('/expenses', {
      query: { offset: 0 },
      unwrapKey: 'expenses',
    });
  });

  it('iteration without limit uses ITERATION_PAGE_SIZE (100)', async () => {
    const { client, get } = makeMockHttp([[]]);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
    );
    // First await sends no limit, but iteration should send limit=100
    const iter = result[Symbol.asyncIterator]();
    await iter.next();
    expect(get).toHaveBeenCalledWith('/expenses', {
      query: { limit: 100, offset: 0 },
      unwrapKey: 'expenses',
    });
  });

  it('advances offset by limit between pages', async () => {
    const { client, get } = makeMockHttp([
      [{ id: 1 }, { id: 2 }],
      [{ id: 3 }, { id: 4 }],
      [],
    ]);
    const result = createPagedResult<{ id: number }>(
      client,
      '/expenses',
      'expenses',
      { limit: 2, offset: 5 },
    );
    for await (const _item of result) {
      // drain
    }
    expect(get).toHaveBeenNthCalledWith(1, '/expenses', {
      query: { limit: 2, offset: 5 },
      unwrapKey: 'expenses',
    });
    expect(get).toHaveBeenNthCalledWith(2, '/expenses', {
      query: { limit: 2, offset: 7 },
      unwrapKey: 'expenses',
    });
    expect(get).toHaveBeenNthCalledWith(3, '/expenses', {
      query: { limit: 2, offset: 9 },
      unwrapKey: 'expenses',
    });
  });

  it('rejects limit:0 at construction (would otherwise infinite-loop)', () => {
    const { client } = makeMockHttp([]);
    expect(() =>
      createPagedResult(client, '/expenses', 'expenses', { limit: 0 }),
    ).toThrow(RangeError);
  });

  it('rejects negative limit', () => {
    const { client } = makeMockHttp([]);
    expect(() =>
      createPagedResult(client, '/expenses', 'expenses', { limit: -5 }),
    ).toThrow(RangeError);
  });

  it('rejects non-integer limit', () => {
    const { client } = makeMockHttp([]);
    expect(() =>
      createPagedResult(client, '/expenses', 'expenses', { limit: 1.5 }),
    ).toThrow(RangeError);
  });

  it('rejects negative offset', () => {
    const { client } = makeMockHttp([]);
    expect(() =>
      createPagedResult(client, '/expenses', 'expenses', { offset: -1 }),
    ).toThrow(RangeError);
  });
});
