/**
 * Fixture generation script for the Splitwise SDK v2.
 *
 * Calls the real Splitwise API using a developer access token and records the
 * raw HTTP responses as JSON files in `test/fixtures/`. Tests can then replay
 * those fixtures via the SDK's injectable fetch (see test/helpers/mock-fetch.ts).
 *
 * Usage:
 *   SPLITWISE_ACCESS_TOKEN=xxx tsx scripts/generate-fixtures.ts
 *
 * Get a token at: https://secure.splitwise.com/oauth_clients
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface FixtureSpec {
  name: string;
  method: 'GET' | 'POST';
  path: string;
}

interface FixtureMeta {
  fixture: string;
  endpoint: string;
  method: string;
  statusCode: number;
  generatedAt: string;
  reviewRequired: boolean;
}

interface FixtureFile {
  _meta: FixtureMeta;
  headers: Record<string, string>;
  body: unknown;
}

const BASE_URL = 'https://secure.splitwise.com/api/v3.0';

// Only keep headers that are useful for replay or debugging. Everything else
// (Set-Cookie, server identifiers, etc.) is dropped to avoid leaking PII.
const ALLOWED_HEADERS = new Set([
  'content-type',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
]);

// Keep this list to safe, read-only endpoints. Anything that mutates state
// (create/update/delete) should be added with explicit care.
const FIXTURES: readonly FixtureSpec[] = [
  { name: 'get-current-user', method: 'GET', path: '/get_current_user' },
  { name: 'get-groups', method: 'GET', path: '/get_groups' },
  { name: 'get-expenses', method: 'GET', path: '/get_expenses?limit=5' },
  {
    name: 'get-expenses-page2',
    method: 'GET',
    path: '/get_expenses?limit=5&offset=5',
  },
  { name: 'get-currencies', method: 'GET', path: '/get_currencies' },
  { name: 'get-categories', method: 'GET', path: '/get_categories' },
  { name: 'get-friends', method: 'GET', path: '/get_friends' },
  { name: 'get-notifications', method: 'GET', path: '/get_notifications' },
  { name: 'test', method: 'GET', path: '/test' },
];

const REQUEST_DELAY_MS = 300;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '..', 'test', 'fixtures');

function printTokenInstructions(): void {
  process.stderr.write(
    [
      'ERROR: SPLITWISE_ACCESS_TOKEN is not set.',
      '',
      'To generate fixtures you need a personal Splitwise access token:',
      '  1. Visit https://secure.splitwise.com/oauth_clients',
      '  2. Register an app (or use an existing one) to obtain a personal',
      '     "API key" / access token.',
      '  3. Re-run with the token in the environment:',
      '       SPLITWISE_ACCESS_TOKEN=your-token-here \\',
      '         tsx scripts/generate-fixtures.ts',
      '',
    ].join('\n'),
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function pickHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (ALLOWED_HEADERS.has(key.toLowerCase())) {
      out[key.toLowerCase()] = value;
    }
  });
  return out;
}

async function fetchFixture(
  spec: FixtureSpec,
  token: string,
): Promise<FixtureFile> {
  const url = `${BASE_URL}${spec.path}`;
  const response = await fetch(url, {
    method: spec.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  let body: unknown = text;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      // Keep the raw text body if the API returned non-JSON.
    }
  } else {
    body = null;
  }

  return {
    _meta: {
      fixture: spec.name,
      endpoint: spec.path,
      method: spec.method,
      statusCode: response.status,
      generatedAt: new Date().toISOString(),
      reviewRequired: true,
    },
    headers: pickHeaders(response.headers),
    body,
  };
}

async function writeFixture(fixture: FixtureFile): Promise<string> {
  const filePath = resolve(FIXTURES_DIR, `${fixture._meta.fixture}.json`);
  await writeFile(filePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  return filePath;
}

async function main(): Promise<number> {
  const token = process.env['SPLITWISE_ACCESS_TOKEN'];
  if (token === undefined || token.length === 0) {
    printTokenInstructions();
    return 1;
  }

  await mkdir(FIXTURES_DIR, { recursive: true });

  const succeeded: string[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const [i, spec] of FIXTURES.entries()) {
    if (i > 0) await delay(REQUEST_DELAY_MS);
    process.stdout.write(`[${i + 1}/${FIXTURES.length}] ${spec.method} ${spec.path} ... `);
    try {
      const fixture = await fetchFixture(spec, token);
      const filePath = await writeFixture(fixture);
      succeeded.push(spec.name);
      process.stdout.write(`OK (${fixture._meta.statusCode}) -> ${filePath}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ name: spec.name, error: message });
      process.stdout.write(`FAILED: ${message}\n`);
    }
  }

  process.stdout.write(
    `\nSummary: ${succeeded.length} succeeded, ${failed.length} failed.\n`,
  );
  if (failed.length > 0) {
    process.stdout.write('Failures:\n');
    for (const f of failed) {
      process.stdout.write(`  - ${f.name}: ${f.error}\n`);
    }
  }

  process.stdout.write(
    [
      '',
      'WARNING: Fixtures may contain personal information (names, email',
      'addresses, group/expense details, profile picture URLs, etc.).',
      'Review every file in test/fixtures/ and scrub PII before committing.',
      'Each fixture has `_meta.reviewRequired: true` until you flip it to false.',
      '',
    ].join('\n'),
  );

  return failed.length > 0 ? 1 : 0;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.stack ?? err.message : String(err);
    process.stderr.write(`Unhandled error: ${message}\n`);
    process.exit(1);
  });
