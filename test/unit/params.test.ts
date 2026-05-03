import { describe, test, expect } from 'vitest';
import {
  toSnakeCase,
  toCamelCase,
  keysToSnakeCase,
  keysToCamelCase,
  flattenParams,
} from '../../src/params.js';

// ---------------------------------------------------------------------------
// toSnakeCase
// ---------------------------------------------------------------------------

describe('toSnakeCase', () => {
  test('converts simple camelCase', () => {
    expect(toSnakeCase('groupId')).toBe('group_id');
  });

  test('converts multiple camel humps', () => {
    expect(toSnakeCase('currencyCode')).toBe('currency_code');
    expect(toSnakeCase('datedAfter')).toBe('dated_after');
  });

  test('handles consecutive uppercase letters', () => {
    expect(toSnakeCase('HTMLParser')).toBe('html_parser');
    expect(toSnakeCase('getHTTPResponse')).toBe('get_http_response');
  });

  test('passes through already snake_case strings', () => {
    expect(toSnakeCase('group_id')).toBe('group_id');
    expect(toSnakeCase('currency_code')).toBe('currency_code');
  });

  test('handles single-word strings', () => {
    expect(toSnakeCase('payment')).toBe('payment');
    expect(toSnakeCase('users')).toBe('users');
  });

  test('handles empty string', () => {
    expect(toSnakeCase('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// toCamelCase
// ---------------------------------------------------------------------------

describe('toCamelCase', () => {
  test('converts simple snake_case', () => {
    expect(toCamelCase('group_id')).toBe('groupId');
  });

  test('converts multiple underscores', () => {
    expect(toCamelCase('currency_code')).toBe('currencyCode');
    expect(toCamelCase('dated_after')).toBe('datedAfter');
  });

  test('passes through already camelCase strings', () => {
    expect(toCamelCase('groupId')).toBe('groupId');
    expect(toCamelCase('currencyCode')).toBe('currencyCode');
  });

  test('handles single-word strings', () => {
    expect(toCamelCase('payment')).toBe('payment');
  });

  test('handles empty string', () => {
    expect(toCamelCase('')).toBe('');
  });

  test('handles leading underscores in segments with digits', () => {
    expect(toCamelCase('user_1_name')).toBe('user1Name');
  });
});

// ---------------------------------------------------------------------------
// keysToSnakeCase
// ---------------------------------------------------------------------------

describe('keysToSnakeCase', () => {
  test('converts top-level keys', () => {
    expect(keysToSnakeCase({ groupId: 1, currencyCode: 'USD' })).toEqual({
      group_id: 1,
      currency_code: 'USD',
    });
  });

  test('converts nested object keys', () => {
    expect(
      keysToSnakeCase({ user: { firstName: 'Alice', lastName: 'Smith' } }),
    ).toEqual({
      user: { first_name: 'Alice', last_name: 'Smith' },
    });
  });

  test('converts keys inside arrays', () => {
    expect(
      keysToSnakeCase({
        users: [{ userId: 1 }, { userId: 2 }],
      }),
    ).toEqual({
      users: [{ user_id: 1 }, { user_id: 2 }],
    });
  });

  test('passes through primitives', () => {
    expect(keysToSnakeCase(42)).toBe(42);
    expect(keysToSnakeCase('hello')).toBe('hello');
    expect(keysToSnakeCase(null)).toBe(null);
    expect(keysToSnakeCase(undefined)).toBe(undefined);
    expect(keysToSnakeCase(true)).toBe(true);
  });

  test('passes through Date instances', () => {
    const date = new Date('2026-01-01');
    expect(keysToSnakeCase(date)).toBe(date);
  });

  test('handles empty objects and arrays', () => {
    expect(keysToSnakeCase({})).toEqual({});
    expect(keysToSnakeCase([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// keysToCamelCase
// ---------------------------------------------------------------------------

describe('keysToCamelCase', () => {
  test('converts top-level keys', () => {
    expect(keysToCamelCase({ group_id: 1, currency_code: 'USD' })).toEqual({
      groupId: 1,
      currencyCode: 'USD',
    });
  });

  test('converts nested object keys', () => {
    expect(
      keysToCamelCase({ user: { first_name: 'Alice', last_name: 'Smith' } }),
    ).toEqual({
      user: { firstName: 'Alice', lastName: 'Smith' },
    });
  });

  test('converts keys inside arrays', () => {
    expect(
      keysToCamelCase({
        users: [{ user_id: 1 }, { user_id: 2 }],
      }),
    ).toEqual({
      users: [{ userId: 1 }, { userId: 2 }],
    });
  });

  test('passes through primitives', () => {
    expect(keysToCamelCase(42)).toBe(42);
    expect(keysToCamelCase('hello')).toBe('hello');
    expect(keysToCamelCase(null)).toBe(null);
    expect(keysToCamelCase(undefined)).toBe(undefined);
  });

  test('passes through Date instances', () => {
    const date = new Date('2026-01-01');
    expect(keysToCamelCase(date)).toBe(date);
  });

  test('handles empty objects and arrays', () => {
    expect(keysToCamelCase({})).toEqual({});
    expect(keysToCamelCase([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe('round-trip key conversion', () => {
  test('keysToSnakeCase -> keysToCamelCase preserves structure', () => {
    const original = {
      groupId: 123,
      currencyCode: 'USD',
      users: [
        { firstName: 'Alice', paidShare: '10.00' },
        { firstName: 'Bob', paidShare: '5.00' },
      ],
    };
    expect(keysToCamelCase(keysToSnakeCase(original))).toEqual(original);
  });

  test('keysToCamelCase -> keysToSnakeCase preserves structure', () => {
    const original = {
      group_id: 123,
      currency_code: 'USD',
      users: [
        { first_name: 'Alice', paid_share: '10.00' },
        { first_name: 'Bob', paid_share: '5.00' },
      ],
    };
    expect(keysToSnakeCase(keysToCamelCase(original))).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// flattenParams
// ---------------------------------------------------------------------------

describe('flattenParams', () => {
  test('preserves existing v1 behavior: creates splitwise compatible parameters', () => {
    // This mirrors the exact test case from the original __tests__/utils.test.js
    expect(
      flattenParams({
        users: [{ user_id: '23456789' }, { user_id: '34567890' }],
        payment: false,
        something_else: true,
      }),
    ).toEqual({
      users__0__user_id: '23456789',
      users__1__user_id: '34567890',
      payment: 0,
      something_else: 1,
    });
  });

  test('flattens user arrays with camelCase key conversion', () => {
    expect(
      flattenParams({
        users: [{ userId: 1, paidShare: '10' }],
      }),
    ).toEqual({
      users__0__user_id: 1,
      users__0__paid_share: '10',
    });
  });

  test('flattens multiple users', () => {
    expect(
      flattenParams({
        users: [
          { userId: 1, paidShare: '10' },
          { userId: 2, paidShare: '5' },
        ],
      }),
    ).toEqual({
      users__0__user_id: 1,
      users__0__paid_share: '10',
      users__1__user_id: 2,
      users__1__paid_share: '5',
    });
  });

  test('converts booleans to 0/1', () => {
    expect(flattenParams({ payment: false })).toEqual({ payment: 0 });
    expect(flattenParams({ payment: true })).toEqual({ payment: 1 });
  });

  test('passes through top-level primitives', () => {
    expect(
      flattenParams({ groupId: 123, description: 'Lunch', cost: '15.50' }),
    ).toEqual({
      group_id: 123,
      description: 'Lunch',
      cost: '15.50',
    });
  });

  test('converts top-level camelCase keys to snake_case', () => {
    expect(flattenParams({ currencyCode: 'USD' })).toEqual({
      currency_code: 'USD',
    });
  });

  test('handles empty objects', () => {
    expect(flattenParams({})).toEqual({});
  });

  test('skips null and undefined values', () => {
    expect(flattenParams({ a: null, b: undefined, c: 'keep' })).toEqual({
      c: 'keep',
    });
  });

  test('flattens nested objects (non-array)', () => {
    expect(
      flattenParams({
        repayments: { debtFrom: 1, debtTo: 2 },
      }),
    ).toEqual({
      repayments__debt_from: 1,
      repayments__debt_to: 2,
    });
  });

  test('converts Date values to ISO strings', () => {
    const date = new Date('2026-05-03T12:00:00Z');
    expect(flattenParams({ updatedAfter: date })).toEqual({
      updated_after: '2026-05-03T12:00:00.000Z',
    });
  });

  test('converts nested Date values inside arrays/objects', () => {
    const date = new Date('2026-05-03T12:00:00Z');
    expect(
      flattenParams({ window: { start: date, end: date } }),
    ).toEqual({
      window__start: '2026-05-03T12:00:00.000Z',
      window__end: '2026-05-03T12:00:00.000Z',
    });
  });

  test('preserves Blob values for the multipart path to consume', () => {
    const blob = new Blob(['fake'], { type: 'image/jpeg' });
    expect(flattenParams({ receipt: blob })).toEqual({ receipt: blob });
  });

  test('preserves Blobs nested in objects/arrays', () => {
    const blob = new Blob(['fake'], { type: 'image/png' });
    expect(
      flattenParams({ attachments: [{ file: blob, label: 'main' }] }),
    ).toEqual({
      attachments__0__file: blob,
      attachments__0__label: 'main',
    });
  });

  test('stringifies URL values', () => {
    expect(flattenParams({ next: new URL('https://example.com/x') })).toEqual({
      next: 'https://example.com/x',
    });
  });
});
