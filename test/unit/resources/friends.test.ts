import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../src/http.js';
import { Friends } from '../../../src/resources/friends.js';

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

describe('Friends', () => {
  describe('list', () => {
    it('calls GET /get_friends', async () => {
      const { client, get } = makeMockHttp();
      const friends = [{ id: 1 }];
      get.mockResolvedValue(friends);
      const result = await new Friends(client).list();
      expect(get).toHaveBeenCalledWith('/get_friends', {
        unwrapKey: 'friends',
      });
      expect(result).toBe(friends);
    });
  });

  describe('get', () => {
    it('calls GET /get_friend/:id', async () => {
      const { client, get } = makeMockHttp();
      const friend = { id: 5 };
      get.mockResolvedValue(friend);
      const result = await new Friends(client).get({ id: 5 });
      expect(get).toHaveBeenCalledWith('/get_friend/5', {
        unwrapKey: 'friend',
      });
      expect(result).toBe(friend);
    });
  });

  describe('create', () => {
    it('POSTs to /create_friend and unwraps the singular "friend" key', async () => {
      const { client, post } = makeMockHttp();
      const friend = { id: 9 };
      post.mockResolvedValue(friend);
      const result = await new Friends(client).create({
        userEmail: 'a@b.com',
        userFirstName: 'Alice',
        userLastName: 'B',
      });
      expect(post).toHaveBeenCalledWith('/create_friend', {
        body: {
          userEmail: 'a@b.com',
          userFirstName: 'Alice',
          userLastName: 'B',
        },
        unwrapKey: 'friend',
      });
      expect(result).toBe(friend);
    });

    it('accepts userEmail alone (first/last name optional)', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue({ id: 1 });
      await new Friends(client).create({ userEmail: 'a@b.com' });
      expect(post).toHaveBeenCalledWith('/create_friend', {
        body: { userEmail: 'a@b.com' },
        unwrapKey: 'friend',
      });
    });
  });

  describe('createMultiple', () => {
    it('POSTs to /create_friends with body wrapped in "users" and unwraps "users"', async () => {
      const { client, post } = makeMockHttp();
      const friends = [{ id: 1 }, { id: 2 }];
      post.mockResolvedValue(friends);
      const result = await new Friends(client).createMultiple({
        friends: [{ email: 'a@b.com', firstName: 'A', lastName: 'B' }],
      });
      expect(post).toHaveBeenCalledWith('/create_friends', {
        body: {
          users: [{ email: 'a@b.com', firstName: 'A', lastName: 'B' }],
        },
        unwrapKey: 'users',
      });
      expect(result).toBe(friends);
    });
  });

  describe('delete', () => {
    it('POSTs to /delete_friend/:id and wraps success', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue(true);
      const result = await new Friends(client).delete({ id: 12 });
      expect(post).toHaveBeenCalledWith('/delete_friend/12', {
        unwrapKey: 'success',
      });
      expect(result).toEqual({ success: true });
    });
  });
});
