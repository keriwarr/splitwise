import { describe, expect, it, vi } from 'vitest';
import { SplitwiseError } from '../../../src/errors.js';
import type { HttpClient } from '../../../src/http.js';
import { Expenses } from '../../../src/resources/expenses.js';

interface MockHttp {
  client: HttpClient;
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

function makeMockHttp(): MockHttp {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const del = vi.fn();
  const client = { get, post, put, delete: del } as unknown as HttpClient;
  return { client, get, post, put, delete: del };
}

describe('Expenses', () => {
  describe('list', () => {
    it('returns a PagedResult that calls get with the right path/options', async () => {
      const { client, get } = makeMockHttp();
      get.mockResolvedValue([{ id: 1 }]);
      const expenses = new Expenses(client);
      const result = expenses.list({ groupId: 5, limit: 10, offset: 20 });
      const page = await result;
      expect(page).toEqual([{ id: 1 }]);
      expect(get).toHaveBeenCalledWith('/get_expenses', {
        query: { groupId: 5, limit: 10, offset: 20 },
        unwrapKey: 'expenses',
      });
    });

    it('handles no params (no client-side limit default)', async () => {
      const { client, get } = makeMockHttp();
      get.mockResolvedValue([]);
      const expenses = new Expenses(client);
      await expenses.list();
      expect(get).toHaveBeenCalledWith('/get_expenses', {
        query: { offset: 0 },
        unwrapKey: 'expenses',
      });
    });
  });

  describe('get', () => {
    it('calls GET /get_expense/:id with unwrapKey', async () => {
      const { client, get } = makeMockHttp();
      const expense = { id: 42 };
      get.mockResolvedValue(expense);
      const expenses = new Expenses(client);
      const result = await expenses.get({ id: 42 });
      expect(get).toHaveBeenCalledWith('/get_expense/42', {
        unwrapKey: 'expense',
      });
      expect(result).toBe(expense);
    });
  });

  describe('create', () => {
    it('POSTs to /create_expense, returns first expense', async () => {
      const { client, post } = makeMockHttp();
      const expense = { id: 100 };
      post.mockResolvedValue([expense]);
      const expenses = new Expenses(client);
      const result = await expenses.create({
        cost: '10.00',
        description: 'Lunch',
      });
      expect(post).toHaveBeenCalledWith('/create_expense', {
        body: { cost: '10.00', description: 'Lunch' },
        unwrapKey: 'expenses',
      });
      expect(result).toBe(expense);
    });

    it('throws SplitwiseError if no expense returned', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue([]);
      const expenses = new Expenses(client);
      await expect(
        expenses.create({ cost: '10.00', description: 'Lunch' }),
      ).rejects.toBeInstanceOf(SplitwiseError);
    });

    it('throws SplitwiseError (not raw TypeError) if response missing expenses key', async () => {
      const { client, post } = makeMockHttp();
      // The HTTP client returns `undefined` (cast as the generic T) when the
      // unwrap key isn't present. Used to crash with TypeError on [0].
      post.mockResolvedValue(undefined);
      const expenses = new Expenses(client);
      await expect(
        expenses.create({ cost: '10.00', description: 'Lunch' }),
      ).rejects.toBeInstanceOf(SplitwiseError);
      await expect(
        expenses.create({ cost: '10.00', description: 'Lunch' }),
      ).rejects.toThrow(/missing or empty/);
    });

    it('passes a receipt Blob through to the http client', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue([{ id: 1 }]);
      const expenses = new Expenses(client);
      const receipt = new Blob(['fake-bytes'], { type: 'image/jpeg' });
      await expenses.create({
        cost: '10.00',
        description: 'Lunch',
        receipt,
      });
      const [, options] = post.mock.calls[0]!;
      expect((options as { body: { receipt: Blob } }).body.receipt).toBe(
        receipt,
      );
    });
  });

  describe('update', () => {
    it('POSTs to /update_expense/:id without id in body', async () => {
      const { client, post } = makeMockHttp();
      const expense = { id: 200 };
      post.mockResolvedValue([expense]);
      const expenses = new Expenses(client);
      const result = await expenses.update({ id: 200, cost: '99.00' });
      expect(post).toHaveBeenCalledWith('/update_expense/200', {
        body: { cost: '99.00' },
        unwrapKey: 'expenses',
      });
      expect(result).toBe(expense);
    });

    it('throws SplitwiseError if no expense returned', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue([]);
      const expenses = new Expenses(client);
      await expect(
        expenses.update({ id: 200, cost: '1.00' }),
      ).rejects.toBeInstanceOf(SplitwiseError);
    });
  });

  describe('delete', () => {
    it('POSTs to /delete_expense/:id and resolves to void', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue(undefined);
      const expenses = new Expenses(client);
      const result = await expenses.delete({ id: 7 });
      expect(post).toHaveBeenCalledWith('/delete_expense/7', undefined);
      expect(result).toBeUndefined();
    });

    it('forwards per-request overrides', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue(undefined);
      const controller = new AbortController();
      await new Expenses(client).delete(
        { id: 7 },
        { signal: controller.signal, timeout: 5000 },
      );
      expect(post).toHaveBeenCalledWith('/delete_expense/7', {
        signal: controller.signal,
        timeout: 5000,
      });
    });
  });

  describe('restore', () => {
    it('POSTs to /undelete_expense/:id and resolves to void', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue(undefined);
      const expenses = new Expenses(client);
      const result = await expenses.restore({ id: 8 });
      expect(post).toHaveBeenCalledWith('/undelete_expense/8', undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('createDebt', () => {
    it('constructs the correct create body', async () => {
      const { client, post } = makeMockHttp();
      const expense = { id: 1 };
      post.mockResolvedValue([expense]);
      const expenses = new Expenses(client);
      await expenses.createDebt({
        paidBy: 1,
        owedBy: 2,
        amount: '50.00',
        description: 'IOU',
        groupId: 99,
        date: '2026-05-02',
      });
      expect(post).toHaveBeenCalledWith('/create_expense', {
        body: {
          payment: false,
          cost: '50.00',
          description: 'IOU',
          groupId: 99,
          date: '2026-05-02',
          users: [
            { userId: 1, paidShare: '50.00' },
            { userId: 2, owedShare: '50.00' },
          ],
        },
        unwrapKey: 'expenses',
      });
    });

    it('omits optional fields when not provided', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue([{ id: 1 }]);
      const expenses = new Expenses(client);
      await expenses.createDebt({
        paidBy: 1,
        owedBy: 2,
        amount: '5.00',
      });
      expect(post).toHaveBeenCalledWith('/create_expense', {
        body: {
          payment: false,
          cost: '5.00',
          description: 'IOU',
          users: [
            { userId: 1, paidShare: '5.00' },
            { userId: 2, owedShare: '5.00' },
          ],
        },
        unwrapKey: 'expenses',
      });
    });

    it('accepts amount as a number and stringifies it', async () => {
      const { client, post } = makeMockHttp();
      post.mockResolvedValue([{ id: 1 }]);
      const expenses = new Expenses(client);
      await expenses.createDebt({
        paidBy: 1,
        owedBy: 2,
        amount: 12.5,
        description: 'Snack',
      });
      expect(post).toHaveBeenCalledWith('/create_expense', {
        body: {
          payment: false,
          cost: '12.5',
          description: 'Snack',
          users: [
            { userId: 1, paidShare: '12.5' },
            { userId: 2, owedShare: '12.5' },
          ],
        },
        unwrapKey: 'expenses',
      });
    });
  });
});
