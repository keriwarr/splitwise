import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../src/http.js';
import { Groups } from '../../../src/resources/groups.js';

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

describe('Groups', () => {
  describe('list', () => {
    it('calls GET /get_groups with unwrapKey', async () => {
      const { client, get } = makeMockHttp();
      const groups = [{ id: 1 }];
      get.mockResolvedValue(groups);
      const result = await new Groups(client).list();
      expect(get).toHaveBeenCalledWith('/get_groups', {
        unwrapKey: 'groups',
      });
      expect(result).toBe(groups);
    });
  });

  describe('get', () => {
    it('calls GET /get_group/:id', async () => {
      const { client, get } = makeMockHttp();
      const group = { id: 5 };
      get.mockResolvedValue(group);
      const result = await new Groups(client).get({ id: 5 });
      expect(get).toHaveBeenCalledWith('/get_group/5', {
        unwrapKey: 'group',
      });
      expect(result).toBe(group);
    });
  });

  describe('create', () => {
    it('POSTs to /create_group with body', async () => {
      const { client, post } = makeMockHttp();
      const group = { id: 10 };
      post.mockResolvedValue(group);
      const result = await new Groups(client).create({ name: 'Trip' });
      expect(post).toHaveBeenCalledWith('/create_group', {
        body: { name: 'Trip' },
        unwrapKey: 'group',
      });
      expect(result).toBe(group);
    });
  });

  describe('delete', () => {
    it('POSTs to /delete_group/:id', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue(true);
      const result = await new Groups(client).delete({ id: 7 });
      expect(post).toHaveBeenCalledWith('/delete_group/7', {
        unwrapKey: 'success',
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('restore', () => {
    it('POSTs to /undelete_group/:id', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue(true);
      const result = await new Groups(client).restore({ id: 8 });
      expect(post).toHaveBeenCalledWith('/undelete_group/8', {
        unwrapKey: 'success',
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('addUser', () => {
    it('POSTs to /add_user_to_group and returns success + user', async () => {
      const { client, post } = makeMockHttp();
      const apiResp = {
        success: true,
        user: { id: 2, firstName: 'Sdk', lastName: 'Test' },
      };
      post.mockResolvedValue(apiResp);
      const result = await new Groups(client).addUser({
        groupId: 1,
        userId: 2,
      });
      expect(post).toHaveBeenCalledWith('/add_user_to_group', {
        body: { groupId: 1, userId: 2 },
      });
      expect(result).toBe(apiResp);
    });
  });

  describe('removeUser', () => {
    it('POSTs to /remove_user_from_group with body', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue(true);
      const result = await new Groups(client).removeUser({
        groupId: 1,
        userId: 2,
      });
      expect(post).toHaveBeenCalledWith('/remove_user_from_group', {
        body: { groupId: 1, userId: 2 },
        unwrapKey: 'success',
      });
      expect(result).toEqual({ success: true });
    });
  });
});
