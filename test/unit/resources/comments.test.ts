import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../../src/http.js';
import { Comments } from '../../../src/resources/comments.js';

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

describe('Comments', () => {
  describe('list', () => {
    it('calls GET /get_comments with expenseId in query', async () => {
      const { client, get } = makeMockHttp();
      const comments = [{ id: 1 }];
      get.mockResolvedValue(comments);
      const result = await new Comments(client).list({ expenseId: 99 });
      expect(get).toHaveBeenCalledWith('/get_comments', {
        query: { expenseId: 99 },
        unwrapKey: 'comments',
      });
      expect(result).toBe(comments);
    });
  });

  describe('create', () => {
    it('POSTs to /create_comment with body', async () => {
      const { client, post } = makeMockHttp();
      const comment = { id: 5 };
      post.mockResolvedValue(comment);
      const result = await new Comments(client).create({
        expenseId: 10,
        content: 'hello',
      });
      expect(post).toHaveBeenCalledWith('/create_comment', {
        body: { expenseId: 10, content: 'hello' },
        unwrapKey: 'comment',
      });
      expect(result).toBe(comment);
    });
  });

  describe('delete', () => {
    it('POSTs to /delete_comment/:id and returns the comment', async () => {
      const { client, post } = makeMockHttp();
      const comment = { id: 5 };
      post.mockResolvedValue(comment);
      const result = await new Comments(client).delete({ id: 5 });
      expect(post).toHaveBeenCalledWith('/delete_comment/5', {
        unwrapKey: 'comment',
      });
      expect(result).toBe(comment);
    });
  });
});
