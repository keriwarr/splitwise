/**
 * Test helpers for replaying recorded fixtures.
 *
 * Tests use these to swap out the SDK's fetch with one that returns a
 * pre-recorded response, decoupling them from the real Splitwise API.
 * See `scripts/generate-fixtures.ts` for how fixtures are produced.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface FixtureFile {
  _meta: {
    fixture: string;
    endpoint: string;
    method: string;
    statusCode: number;
    generatedAt: string;
    reviewRequired: boolean;
  };
  headers: Record<string, string>;
  body: unknown;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '..', 'fixtures');

/** Load a fixture file from test/fixtures/. */
export function loadFixture(name: string): FixtureFile {
  const filePath = resolve(FIXTURES_DIR, `${name}.json`);
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as FixtureFile;
}

/**
 * Build a fetch mock that returns a given fixture's response. The mock ignores
 * its inputs (URL, init) and always responds with the recorded status, headers,
 * and body. Tests that need to assert request shape can wrap this in vi.fn().
 */
export function fetchFromFixture(name: string): typeof fetch {
  const fixture = loadFixture(name);
  return (async () => buildResponse(fixture)) as unknown as typeof fetch;
}

function buildResponse(fixture: FixtureFile): Response {
  const headers = new Headers(fixture.headers);
  // Default content-type so response.json() works even if the recorded fixture
  // omitted the header.
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  const body =
    typeof fixture.body === 'string'
      ? fixture.body
      : JSON.stringify(fixture.body);
  return new Response(body, {
    status: fixture._meta.statusCode,
    headers,
  });
}
