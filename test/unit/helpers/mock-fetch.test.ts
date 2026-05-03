import { describe, expect, it } from 'vitest';
import {
  fetchFromFixture,
  loadFixture,
} from '../../helpers/mock-fetch.js';

describe('loadFixture', () => {
  it('loads a known fixture from disk', () => {
    const fixture = loadFixture('example');

    expect(fixture._meta.fixture).toBe('example');
    expect(fixture._meta.endpoint).toBe('/test');
    expect(fixture._meta.method).toBe('GET');
    expect(fixture._meta.statusCode).toBe(200);
    expect(fixture._meta.reviewRequired).toBe(false);
    expect(fixture.headers['content-type']).toBe(
      'application/json; charset=utf-8',
    );
    expect(fixture.body).toEqual({
      success: true,
      message: 'hand-written example fixture',
    });
  });

  it('throws when the fixture does not exist', () => {
    expect(() => loadFixture('does-not-exist')).toThrow();
  });
});

describe('fetchFromFixture', () => {
  it('returns a Response with the fixture status, headers, and body', async () => {
    const mockFetch = fetchFromFixture('example');
    const response = await mockFetch('https://example.invalid/anything');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/json; charset=utf-8',
    );
    expect(response.headers.get('x-ratelimit-limit')).toBe('100');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('99');

    const body = await response.json();
    expect(body).toEqual({
      success: true,
      message: 'hand-written example fixture',
    });
  });

  it('ignores its inputs and always returns the recorded response', async () => {
    const mockFetch = fetchFromFixture('example');

    const r1 = await mockFetch('https://example.invalid/a', { method: 'POST' });
    const r2 = await mockFetch('https://example.invalid/b');

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(await r1.json()).toEqual(await r2.json());
  });
});
