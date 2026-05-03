/**
 * Fixture-driven integration tests.
 *
 * Replays real Splitwise API responses (recorded in test/fixtures/) through the
 * SDK and asserts that response parsing, key conversion, and unwrapping all
 * work end-to-end. These tests are the closest we get to live-API verification
 * without requiring credentials in CI.
 *
 * Tests deliberately avoid hard-coding IDs from the recorded fixtures (those
 * change every time the fixture script runs); they assert on shapes, types,
 * and the values we sent in the request.
 */

import { describe, expect, it } from 'vitest';
import { Splitwise } from '../../src/client.js';
import { fetchFromFixture, loadFixture } from '../helpers/mock-fetch.js';

function clientForFixture(name: string): Splitwise {
  return new Splitwise({
    accessToken: 'test-token',
    fetch: fetchFromFixture(name),
  });
}

/**
 * Read a value from a recorded fixture body using a dotted path. Used so
 * tests can pluck the IDs / fields the fixture happens to have without
 * hard-coding values that change on every regen.
 */
function fromFixture<T = unknown>(name: string, path: string): T {
  const fixture = loadFixture(name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = fixture.body;
  for (const seg of path.split('.')) {
    cur = cur?.[/^\d+$/.test(seg) ? Number(seg) : seg];
  }
  return cur as T;
}

describe('fixture-driven integration', () => {
  describe('users.getCurrent', () => {
    it('parses /get_current_user', async () => {
      const sw = clientForFixture('get-current-user');
      const me = await sw.users.getCurrent();
      expect(typeof me.id).toBe('number');
      // Auto-scrubbed by the fixture script
      expect(me.firstName).toBe('Test');
      expect(me.email).toBe('test+sdk@example.com');
      expect(typeof me.defaultCurrency).toBe('string');
      expect(typeof me.locale).toBe('string');
      expect(me.notifications).toBeDefined();
      // notifications is a free-form bag; just verify it's a plain object
      expect(typeof me.notifications).toBe('object');
    });
  });

  describe('groups.list', () => {
    it('parses /get_groups (always returns at least the "Non-group expenses" group)', async () => {
      const sw = clientForFixture('get-groups');
      const groups = await sw.groups.list();
      expect(groups.length).toBeGreaterThanOrEqual(1);
      const nonGroup = groups.find((g) => g.id === 0);
      expect(nonGroup).toBeDefined();
      expect(nonGroup?.name).toBe('Non-group expenses');
      expect(nonGroup?.avatar?.xlarge).toBeDefined();
      expect(nonGroup?.tallAvatar?.xlarge).toBeDefined();
    });
  });

  describe('groups.get (populated)', () => {
    it('parses a group with members and debts', async () => {
      const groupId = fromFixture<number>('get-group-populated', 'group.id');
      const sw = clientForFixture('get-group-populated');
      const group = await sw.groups.get({ id: groupId });
      expect(group.name).toContain('sdk-fixture-test');
      expect(group.simplifyByDefault).toBe(true);
      expect(group.members?.length).toBeGreaterThanOrEqual(1);
      expect(group.originalDebts?.[0]?.amount).toMatch(/^\d/);
      expect(group.originalDebts?.[0]?.currencyCode).toBe('USD');
      expect(typeof group.whiteboardLockVersion).toBe('number');
      expect(group.coverPhoto?.xxlarge).toBeDefined();
    });
  });

  describe('expenses.list', () => {
    it('parses /get_expenses (populated)', async () => {
      const sw = clientForFixture('get-expenses-populated');
      const expenses = await sw.expenses.list({ limit: 5 });
      expect(expenses.length).toBeGreaterThan(0);
      expect(typeof expenses[0]?.cost).toBe('string');
    });
  });

  describe('expenses.get (populated)', () => {
    it('parses an expense with users, repayments, and comments', async () => {
      const expenseId = fromFixture<number>(
        'get-expense-populated',
        'expense.id',
      );
      const sw = clientForFixture('get-expense-populated');
      const expense = await sw.expenses.get({ id: expenseId });
      expect(expense.id).toBe(expenseId);
      expect(typeof expense.cost).toBe('string');
      expect(expense.currencyCode).toBe('USD');
      expect(expense.transactionMethod).toBe('offline');
      expect(expense.payment).toBe(false);
      expect(expense.users?.length).toBe(2);
      expect(typeof expense.users?.[0]?.netBalance).toBe('string');
      expect(expense.repayments?.length).toBeGreaterThanOrEqual(1);
      expect(expense.comments?.length).toBeGreaterThanOrEqual(1);
      expect(expense.comments?.[0]?.relationType).toBe('ExpenseComment');
    });
  });

  describe('expenses.create', () => {
    it('parses a create_expense response and unwraps the first item', async () => {
      const fixtureExpenseId = fromFixture<number>(
        'create-expense',
        'expenses.0.id',
      );
      const sw = clientForFixture('create-expense');
      const expense = await sw.expenses.create({
        cost: '20.00',
        description: 'sdk-fixture-test expense',
        groupId: 0,
        currencyCode: 'USD',
        splitEqually: true,
      });
      expect(expense.id).toBe(fixtureExpenseId);
      expect(expense.description).toBe('sdk-fixture-test expense');
      expect(expense.transactionMethod).toBe('offline');
      expect(typeof expense.cost).toBe('string');
    });
  });

  describe('expenses.delete / undelete', () => {
    it('delete_expense resolves to void on success', async () => {
      const sw = clientForFixture('delete-expense');
      await expect(sw.expenses.delete({ id: 1 })).resolves.toBeUndefined();
    });

    it('undelete_expense resolves to void on success', async () => {
      const sw = clientForFixture('undelete-expense');
      await expect(sw.expenses.restore({ id: 1 })).resolves.toBeUndefined();
    });
  });

  describe('expenses.update (200 success)', () => {
    it('parses a successful update_expense response', async () => {
      const sw = clientForFixture('update-expense');
      const expense = await sw.expenses.update({
        id: 1,
        description: 'new description',
      });
      expect(typeof expense.id).toBe('number');
      expect(expense.description).toContain('updated');
    });
  });

  describe('friends.create', () => {
    it('parses create_friend with the singular `friend` wrapper', async () => {
      const expectedId = fromFixture<number>('create-friend', 'friend.id');
      const sw = clientForFixture('create-friend');
      const friend = await sw.friends.create({
        userEmail: 'sdk-fixture-test@example.com',
        userFirstName: 'Sdk',
        userLastName: 'Test',
      });
      expect(friend.id).toBe(expectedId);
      expect(friend.firstName).toBe('Sdk');
      expect(friend.email).toMatch(/^sdk-fixture-test/);
      expect(friend.registrationStatus).toBe('dummy');
    });
  });

  describe('friends.get (populated)', () => {
    it('parses a friend with balances and group memberships', async () => {
      const friendId = fromFixture<number>('get-friend-populated', 'friend.id');
      const sw = clientForFixture('get-friend-populated');
      const friend = await sw.friends.get({ id: friendId });
      expect(friend.id).toBe(friendId);
      expect(friend.balance[0]?.currencyCode).toBe('USD');
      expect(typeof friend.balance[0]?.amount).toBe('string');
      expect(friend.groups.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('friends.delete', () => {
    it('delete_friend resolves to void on success', async () => {
      const sw = clientForFixture('delete-friend');
      await expect(sw.friends.delete({ id: 1 })).resolves.toBeUndefined();
    });
  });

  describe('groups.create', () => {
    it('parses create_group', async () => {
      const sw = clientForFixture('create-group');
      const group = await sw.groups.create({
        name: 'sdk-fixture-test-group',
        groupType: 'other',
        simplifyByDefault: true,
      });
      expect(typeof group.id).toBe('number');
      expect(group.name).toContain('sdk-fixture-test');
      expect(group.simplifyByDefault).toBe(true);
    });
  });

  describe('groups.addUser', () => {
    it('parses add_user_to_group and returns the added user', async () => {
      const expectedUserId = fromFixture<number>(
        'add-user-to-group',
        'user.id',
      );
      const sw = clientForFixture('add-user-to-group');
      const user = await sw.groups.addUser({
        groupId: 1,
        userId: expectedUserId,
      });
      expect(user.id).toBe(expectedUserId);
      expect(user.firstName).toBe('Sdk');
    });
  });

  describe('comments', () => {
    it('parses create_comment', async () => {
      const expectedId = fromFixture<number>('create-comment', 'comment.id');
      const sw = clientForFixture('create-comment');
      const comment = await sw.comments.create({
        expenseId: 1,
        content: 'sdk-fixture-test comment',
      });
      expect(comment.id).toBe(expectedId);
      expect(comment.content).toBe('sdk-fixture-test comment');
      expect(comment.commentType).toBe('User');
      expect(comment.relationType).toBe('ExpenseComment');
      expect(comment.user?.firstName).toBe('Test');
    });

    it('parses get_comments (populated)', async () => {
      const sw = clientForFixture('get-comments-populated');
      const comments = await sw.comments.list({ expenseId: 1 });
      expect(comments.length).toBeGreaterThanOrEqual(1);
      expect(comments[0]?.deletedAt).toBeNull();
    });

    it('parses delete_comment (returns the deleted comment)', async () => {
      const expectedId = fromFixture<number>('delete-comment', 'comment.id');
      const sw = clientForFixture('delete-comment');
      const comment = await sw.comments.delete({ id: expectedId });
      expect(comment.id).toBe(expectedId);
      expect(comment.deletedAt).not.toBeNull();
    });
  });

  describe('currencies.list', () => {
    it('parses /get_currencies', async () => {
      const sw = clientForFixture('get-currencies');
      const currencies = await sw.currencies.list();
      expect(currencies.length).toBeGreaterThan(0);
      expect(currencies[0]?.currencyCode).toBeDefined();
      expect(currencies[0]?.unit).toBeDefined();
    });
  });

  describe('categories.list', () => {
    it('parses /get_categories', async () => {
      const sw = clientForFixture('get-categories');
      const categories = await sw.categories.list();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]?.iconTypes?.slim).toBeDefined();
      expect(categories[0]?.iconTypes?.square).toBeDefined();
    });
  });

  describe('notifications.list', () => {
    it('parses /get_notifications', async () => {
      const sw = clientForFixture('get-notifications');
      const result = await sw.notifications.list();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('test (whoami)', () => {
    it('parses /test (returns client_id, token, etc.)', async () => {
      const sw = clientForFixture('test');
      const result = await sw.test();
      expect(typeof result.clientId).toBe('number');
      expect(result.token.tokenType).toBe('bearer');
      expect(result.requestUrl).toContain('/test');
    });
  });
});
