import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../src/http.js';
import { Categories } from '../../../src/resources/categories.js';

interface MockHttp {
  client: HttpClient;
  get: ReturnType<typeof vi.fn>;
}

function makeMockHttp(): MockHttp {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const del = vi.fn();
  const client = { get, post, put, delete: del } as unknown as HttpClient;
  return { client, get };
}

describe('Categories', () => {
  it('calls GET /get_categories', async () => {
    const { client, get } = makeMockHttp();
    const categories = [{ id: 1, name: 'Food' }];
    get.mockResolvedValue(categories);
    const result = await new Categories(client).list();
    expect(get).toHaveBeenCalledWith('/get_categories', {
      unwrapKey: 'categories',
    });
    expect(result).toBe(categories);
  });
});
