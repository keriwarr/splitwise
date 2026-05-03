import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../src/http.js';
import { Users } from '../../../src/resources/users.js';

interface MockHttp {
  client: HttpClient;
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
}

function makeMockHttp(): MockHttp {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const del = vi.fn();
  const client = { get, post, put, delete: del } as unknown as HttpClient;
  return { client, get, post };
}

describe('Users', () => {
  describe('getCurrent', () => {
    it('calls GET /get_current_user', async () => {
      const { client, get } = makeMockHttp();
      const user = { id: 1 };
      get.mockResolvedValue(user);
      const result = await new Users(client).getCurrent();
      expect(get).toHaveBeenCalledWith('/get_current_user', {
        unwrapKey: 'user',
      });
      expect(result).toBe(user);
    });
  });

  describe('get', () => {
    it('calls GET /get_user/:id', async () => {
      const { client, get } = makeMockHttp();
      const user = { id: 7 };
      get.mockResolvedValue(user);
      const result = await new Users(client).get({ id: 7 });
      expect(get).toHaveBeenCalledWith('/get_user/7', { unwrapKey: 'user' });
      expect(result).toBe(user);
    });
  });

  describe('update', () => {
    it('POSTs to /update_user/:id without id in body', async () => {
      const { client, post } = makeMockHttp();
      const user = { id: 7 };
      post.mockResolvedValue(user);
      const result = await new Users(client).update({
        id: 7,
        firstName: 'Bob',
      });
      expect(post).toHaveBeenCalledWith('/update_user/7', {
        body: { firstName: 'Bob' },
        unwrapKey: 'user',
      });
      expect(result).toBe(user);
    });
  });
});
