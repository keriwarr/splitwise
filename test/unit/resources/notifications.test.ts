import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../src/http.js';
import { Notifications } from '../../../src/resources/notifications.js';

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

describe('Notifications', () => {
  it('calls GET /get_notifications with no query when no params', async () => {
    const { client, get } = makeMockHttp();
    const notifs = [{ id: 1 }];
    get.mockResolvedValue(notifs);
    const result = await new Notifications(client).list();
    expect(get).toHaveBeenCalledWith('/get_notifications', {
      query: undefined,
      unwrapKey: 'notifications',
    });
    expect(result).toBe(notifs);
  });

  it('calls GET /get_notifications with query params when provided', async () => {
    const { client, get } = makeMockHttp();
    get.mockResolvedValue([]);
    await new Notifications(client).list({
      updatedAfter: '2026-01-01',
      limit: 50,
    });
    expect(get).toHaveBeenCalledWith('/get_notifications', {
      query: { updatedAfter: '2026-01-01', limit: 50 },
      unwrapKey: 'notifications',
    });
  });
});
