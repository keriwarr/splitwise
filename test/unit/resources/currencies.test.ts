import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../src/http.js';
import { Currencies } from '../../../src/resources/currencies.js';

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

describe('Currencies', () => {
  it('calls GET /get_currencies', async () => {
    const { client, get } = makeMockHttp();
    const currencies = [{ currencyCode: 'USD', unit: '$' }];
    get.mockResolvedValue(currencies);
    const result = await new Currencies(client).list();
    expect(get).toHaveBeenCalledWith('/get_currencies', {
      unwrapKey: 'currencies',
    });
    expect(result).toBe(currencies);
  });
});
