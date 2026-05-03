/**
 * Fixture generation script for the Splitwise SDK v2.
 *
 * Calls the real Splitwise API using a developer access token and records the
 * raw HTTP responses as JSON files in `test/fixtures/`. Tests can then replay
 * those fixtures via the SDK's injectable fetch (see test/helpers/mock-fetch.ts).
 *
 * Usage:
 *   # Read-only mode (safe; just hits GET endpoints)
 *   SPLITWISE_ACCESS_TOKEN=xxx tsx scripts/generate-fixtures.ts
 *
 *   # Mutative mode (CREATES + DELETES test data on your account!)
 *   SPLITWISE_ACCESS_TOKEN=xxx \
 *     SPLITWISE_FIXTURE_MUTATE=1 \
 *     tsx scripts/generate-fixtures.ts
 *
 * SAFETY NOTES:
 *   - Mutative mode creates a friend, a group, an expense, and a comment, then
 *     records responses from POST/GET endpoints, then attempts to clean up
 *     everything it created. Run on a DEDICATED test account, never on your
 *     personal one.
 *   - If cleanup fails partway through, you may need to manually delete leftover
 *     test data from your Splitwise account.
 *   - Token: get one at https://secure.splitwise.com/apps (the "Your API key"
 *     section on your registered app).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const REQUEST_DELAY_MS = 300;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '..', 'test', 'fixtures');

// Identifiable strings used in created test data. Helps you find and clean up
// stragglers if cleanup fails.
const TEST_LABEL = 'sdk-fixture-test';

// Replacement values written into fixtures in place of personal data.
const SCRUB = {
  firstName: 'Test',
  lastName: 'User',
  email: 'test+sdk@example.com',
  token: 'SCRUBBED',
  addFriendUrl: 'https://www.splitwise.com/l/add_friend/SCRUBBED',
  inviteLink: 'https://www.splitwise.com/l/SCRUBBED',
} as const;

// Field names whose string value should always be replaced (regardless of the
// content) before the fixture is written. This catches PII even when we don't
// know the exact value (e.g. a group invite link from a future endpoint).
const ALWAYS_SCRUB_FIELDS: ReadonlyMap<string, string> = new Map([
  ['access_token', SCRUB.token],
  ['add_friend_url', SCRUB.addFriendUrl],
  ['invite_link', SCRUB.inviteLink],
]);

// ===== HTTP helpers =========================================================

interface ApiCallSpec {
  name: string;          // fixture filename (without .json)
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, string | number | boolean | undefined | null>;
}

interface ApiCallResult {
  fixture: FixtureFile;
  body: unknown;         // parsed body (same as fixture.body)
  ok: boolean;           // 2xx
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

function encodeFormBody(
  body: Record<string, string | number | boolean | undefined | null>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'boolean') params.append(k, v ? '1' : '0');
    else params.append(k, String(v));
  }
  return params.toString();
}

async function callApi(spec: ApiCallSpec, token: string): Promise<ApiCallResult> {
  const url = `${BASE_URL}${spec.path}`;
  const init: RequestInit = {
    method: spec.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  };
  if (spec.body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] =
      'application/x-www-form-urlencoded';
    init.body = encodeFormBody(spec.body);
  }

  const response = await fetch(url, init);
  const text = await response.text();
  let body: unknown = text;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      // Keep raw text body for non-JSON responses.
    }
  } else {
    body = null;
  }

  const fixture: FixtureFile = {
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

  return { fixture, body, ok: response.ok };
}

async function writeFixture(fixture: FixtureFile): Promise<string> {
  const filePath = resolve(FIXTURES_DIR, `${fixture._meta.fixture}.json`);
  await writeFile(filePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  return filePath;
}

// ===== PII scrubbing ========================================================

interface ScrubMap {
  /** Verbatim string values that should be replaced wherever they appear. */
  values: Map<string, string>;
}

/** Build a scrub map from a /get_current_user response. */
function buildScrubMap(currentUserBody: unknown): ScrubMap {
  const values = new Map<string, string>();
  const user =
    (currentUserBody as { user?: Record<string, unknown> } | undefined)?.user;
  if (user !== undefined) {
    if (typeof user['first_name'] === 'string' && user['first_name'].length > 0) {
      values.set(user['first_name'], SCRUB.firstName);
    }
    if (typeof user['last_name'] === 'string' && user['last_name'].length > 0) {
      values.set(user['last_name'], SCRUB.lastName);
    }
    if (typeof user['email'] === 'string' && user['email'].length > 0) {
      values.set(user['email'], SCRUB.email);
    }
  }
  return { values };
}

/** Recursively walk a parsed JSON body and replace PII in-place. */
function scrub(body: unknown, map: ScrubMap): unknown {
  if (Array.isArray(body)) {
    return body.map((v) => scrub(v, map));
  }
  if (body !== null && typeof body === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      const fieldReplacement = ALWAYS_SCRUB_FIELDS.get(k);
      if (fieldReplacement !== undefined && typeof v === 'string') {
        out[k] = fieldReplacement;
      } else {
        out[k] = scrub(v, map);
      }
    }
    return out;
  }
  if (typeof body === 'string') {
    const replacement = map.values.get(body);
    if (replacement !== undefined) return replacement;
    return body;
  }
  return body;
}

interface RunContext {
  token: string;
  /** Built lazily after the first /get_current_user call. */
  scrubMap: ScrubMap;
  results: { succeeded: string[]; failed: { name: string; error: string }[] };
}

// Convenience: run a call, scrub the response, write the fixture, log result.
// Returns the *unscrubbed* body so callers can read IDs etc. for follow-up
// requests.
async function record(spec: ApiCallSpec, ctx: RunContext): Promise<unknown> {
  process.stdout.write(`  ${spec.method} ${spec.path} ... `);
  try {
    const { fixture, body, ok } = await callApi(spec, ctx.token);
    const scrubbedFixture: FixtureFile = {
      ...fixture,
      body: scrub(fixture.body, ctx.scrubMap),
    };
    await writeFixture(scrubbedFixture);
    if (ok) {
      ctx.results.succeeded.push(spec.name);
      process.stdout.write(`OK (${fixture._meta.statusCode})\n`);
    } else {
      ctx.results.failed.push({
        name: spec.name,
        error: `HTTP ${fixture._meta.statusCode}`,
      });
      process.stdout.write(`HTTP ${fixture._meta.statusCode}\n`);
    }
    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.results.failed.push({ name: spec.name, error: message });
    process.stdout.write(`FAILED: ${message}\n`);
    return undefined;
  }
}

// ===== Fixture phases =======================================================

// Note: get-current-user is recorded separately first (before this list)
// because we need its response to build the PII scrub map.
const READONLY_FIXTURES: readonly ApiCallSpec[] = [
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

interface MutativeArtifacts {
  friendId?: number;
  groupId?: number;
  expenseId?: number;
  commentId?: number;
}

/**
 * Bootstrap step: hit /get_current_user without any scrubbing in place to learn
 * the user's identity, then build a scrub map and write the fixture (now
 * scrubbed). Returns the unscrubbed body so callers can read the user id.
 */
async function bootstrapScrubMap(ctx: RunContext): Promise<unknown> {
  process.stdout.write('\n=== Bootstrap: identifying current user for PII scrubbing ===\n');
  process.stdout.write('  GET /get_current_user ... ');
  const { fixture, body, ok } = await callApi(
    { name: 'get-current-user', method: 'GET', path: '/get_current_user' },
    ctx.token,
  );
  if (!ok) {
    ctx.results.failed.push({
      name: 'get-current-user',
      error: `HTTP ${fixture._meta.statusCode}`,
    });
    process.stdout.write(`HTTP ${fixture._meta.statusCode}\n`);
    return undefined;
  }
  ctx.scrubMap = buildScrubMap(body);
  await writeFixture({ ...fixture, body: scrub(fixture.body, ctx.scrubMap) });
  ctx.results.succeeded.push('get-current-user');
  process.stdout.write(
    `OK (${fixture._meta.statusCode}) - scrub map: ${ctx.scrubMap.values.size} value(s)\n`,
  );
  return body;
}

/**
 * Read-only phase: hit GET endpoints in their natural state. Always run.
 */
async function runReadonlyPhase(ctx: RunContext): Promise<void> {
  process.stdout.write('\n=== Phase 1: read-only fixtures ===\n');
  for (const [i, spec] of READONLY_FIXTURES.entries()) {
    if (i > 0) await delay(REQUEST_DELAY_MS);
    await record(spec, ctx);
  }
}

/**
 * Mutative phase: create test data, record write-endpoint responses, re-record
 * GETs against the populated state, then clean everything up.
 */
async function runMutativePhase(
  ctx: RunContext,
  currentUserBody: unknown,
): Promise<void> {
  process.stdout.write('\n=== Phase 2: mutative fixtures ===\n');
  process.stdout.write(
    'Creating: 1 friend, 1 group, 1 expense, 1 comment.\n' +
      'These will be deleted in the cleanup phase. Run on a TEST account only.\n\n',
  );

  const artifacts: MutativeArtifacts = {};

  const currentUserId = (currentUserBody as { user?: { id: number } } | undefined)
    ?.user?.id;
  if (currentUserId === undefined) {
    process.stdout.write('Could not determine current user id; aborting.\n');
    return;
  }

  // Create a friend (random suffix avoids collisions across runs)
  const suffix = Math.random().toString(36).slice(2, 8);
  const friendEmail = `${TEST_LABEL}-friend-${suffix}@example.com`;
  const createFriendResp = (await record(
    {
      name: 'create-friend',
      method: 'POST',
      path: '/create_friend',
      body: {
        user_email: friendEmail,
        user_first_name: 'Sdk',
        user_last_name: 'Test',
      },
    },
    ctx,
  )) as { friend?: { id: number } } | undefined;
  artifacts.friendId = createFriendResp?.friend?.id;
  await delay(REQUEST_DELAY_MS);

  // Create a group
  const groupName = `${TEST_LABEL}-group-${suffix}`;
  const createGroupResp = (await record(
    {
      name: 'create-group',
      method: 'POST',
      path: '/create_group',
      body: {
        name: groupName,
        group_type: 'other',
        simplify_by_default: true,
      },
    },
    ctx,
  )) as { group?: { id: number } } | undefined;
  artifacts.groupId = createGroupResp?.group?.id;
  await delay(REQUEST_DELAY_MS);

  // Add the friend to the group (if both exist)
  if (artifacts.groupId !== undefined && artifacts.friendId !== undefined) {
    await record(
      {
        name: 'add-user-to-group',
        method: 'POST',
        path: '/add_user_to_group',
        body: {
          group_id: artifacts.groupId,
          user_id: artifacts.friendId,
        },
      },
      ctx,
    );
    await delay(REQUEST_DELAY_MS);
  }

  // Create an expense in the group
  if (artifacts.groupId !== undefined) {
    const createExpenseResp = (await record(
      {
        name: 'create-expense',
        method: 'POST',
        path: '/create_expense',
        body: {
          cost: '20.00',
          description: `${TEST_LABEL} expense`,
          group_id: artifacts.groupId,
          currency_code: 'USD',
          split_equally: true,
        },
      },
      ctx,
    )) as { expenses?: { id: number }[] } | undefined;
    artifacts.expenseId = createExpenseResp?.expenses?.[0]?.id;
    await delay(REQUEST_DELAY_MS);

    // Update the expense to confirm update path
    if (artifacts.expenseId !== undefined) {
      await record(
        {
          name: 'update-expense',
          method: 'POST',
          path: `/update_expense/${artifacts.expenseId}`,
          body: {
            cost: '25.00',
            description: `${TEST_LABEL} expense (updated)`,
            group_id: artifacts.groupId,
            currency_code: 'USD',
            // Note: split_equally is NOT accepted by /update_expense.
          },
        },
        ctx,
      );
      await delay(REQUEST_DELAY_MS);

      // Comment on the expense
      const createCommentResp = (await record(
        {
          name: 'create-comment',
          method: 'POST',
          path: '/create_comment',
          body: {
            expense_id: artifacts.expenseId,
            content: `${TEST_LABEL} comment`,
          },
        },
        ctx,
      )) as { comment?: { id: number } } | undefined;
      artifacts.commentId = createCommentResp?.comment?.id;
      await delay(REQUEST_DELAY_MS);
    }
  }

  // ----- Re-fetch GET endpoints with populated data --------------------------
  process.stdout.write('\n--- Re-recording GETs against populated state ---\n');

  await record(
    {
      name: 'get-groups-populated',
      method: 'GET',
      path: '/get_groups',
    },
    ctx,
  );
  await delay(REQUEST_DELAY_MS);

  if (artifacts.groupId !== undefined) {
    await record(
      {
        name: 'get-group-populated',
        method: 'GET',
        path: `/get_group/${artifacts.groupId}`,
      },
      ctx,
    );
    await delay(REQUEST_DELAY_MS);
  }

  await record(
    {
      name: 'get-expenses-populated',
      method: 'GET',
      path: '/get_expenses?limit=5',
    },
    ctx,
  );
  await delay(REQUEST_DELAY_MS);

  if (artifacts.expenseId !== undefined) {
    await record(
      {
        name: 'get-expense-populated',
        method: 'GET',
        path: `/get_expense/${artifacts.expenseId}`,
      },
      ctx,
    );
    await delay(REQUEST_DELAY_MS);

    await record(
      {
        name: 'get-comments-populated',
        method: 'GET',
        path: `/get_comments?expense_id=${artifacts.expenseId}`,
      },
      ctx,
    );
    await delay(REQUEST_DELAY_MS);
  }

  await record(
    {
      name: 'get-friends-populated',
      method: 'GET',
      path: '/get_friends',
    },
    ctx,
  );
  await delay(REQUEST_DELAY_MS);

  if (artifacts.friendId !== undefined) {
    await record(
      {
        name: 'get-friend-populated',
        method: 'GET',
        path: `/get_friend/${artifacts.friendId}`,
      },
      ctx,
    );
    await delay(REQUEST_DELAY_MS);
  }

  // ----- Cleanup ------------------------------------------------------------
  process.stdout.write('\n--- Cleanup phase ---\n');

  if (artifacts.commentId !== undefined) {
    await record(
      {
        name: 'delete-comment',
        method: 'POST',
        path: `/delete_comment/${artifacts.commentId}`,
      },
      ctx,
    );
    await delay(REQUEST_DELAY_MS);
  }

  if (artifacts.expenseId !== undefined) {
    await record(
      {
        name: 'delete-expense',
        method: 'POST',
        path: `/delete_expense/${artifacts.expenseId}`,
      },
      ctx,
    );
    await delay(REQUEST_DELAY_MS);

    // Test undelete (restore) and re-delete to capture both responses
    await record(
      {
        name: 'undelete-expense',
        method: 'POST',
        path: `/undelete_expense/${artifacts.expenseId}`,
      },
      ctx,
    );
    await delay(REQUEST_DELAY_MS);

    await record(
      {
        name: 'delete-expense-final',
        method: 'POST',
        path: `/delete_expense/${artifacts.expenseId}`,
      },
      ctx,
    );
    await delay(REQUEST_DELAY_MS);
  }

  if (artifacts.groupId !== undefined) {
    await record(
      {
        name: 'delete-group',
        method: 'POST',
        path: `/delete_group/${artifacts.groupId}`,
      },
      ctx,
    );
    await delay(REQUEST_DELAY_MS);
  }

  if (artifacts.friendId !== undefined) {
    await record(
      {
        name: 'delete-friend',
        method: 'POST',
        path: `/delete_friend/${artifacts.friendId}`,
      },
      ctx,
    );
  }

  process.stdout.write('\nMutative phase complete.\n');
  process.stdout.write(
    'If any cleanup step failed, manually delete leftover test data\n' +
      `(search Splitwise for items containing "${TEST_LABEL}").\n`,
  );
}

// ===== Entry point ==========================================================

function printTokenInstructions(): void {
  process.stderr.write(
    [
      'ERROR: SPLITWISE_ACCESS_TOKEN is not set.',
      '',
      'To generate fixtures you need a personal Splitwise access token:',
      '  1. Visit https://secure.splitwise.com/apps',
      '  2. Register an app (or use an existing one) and copy the',
      '     "Your API key" value from the app page.',
      '  3. Re-run with the token in the environment:',
      '       SPLITWISE_ACCESS_TOKEN=your-token-here \\',
      '         tsx scripts/generate-fixtures.ts',
      '',
    ].join('\n'),
  );
}

function printMutativeWarning(): void {
  process.stdout.write(
    [
      '',
      '************************************************************',
      '*  MUTATIVE MODE ENABLED                                   *',
      '*                                                          *',
      '*  This will create test data on your Splitwise account:   *',
      `*    - 1 friend (email contains "${TEST_LABEL}")    *`,
      `*    - 1 group  (name contains  "${TEST_LABEL}")    *`,
      '*    - 1 expense in that group                             *',
      '*    - 1 comment on that expense                           *',
      '*                                                          *',
      '*  Cleanup deletes everything we created. If cleanup fails *',
      '*  partway, you may need to manually clean up stragglers.  *',
      '*                                                          *',
      '*  RUN THIS ON A DEDICATED TEST ACCOUNT, NEVER ON YOUR     *',
      '*  PERSONAL ACCOUNT.                                       *',
      '************************************************************',
      '',
      'Continuing in 5 seconds. Press Ctrl-C to abort.',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<number> {
  const token = process.env['SPLITWISE_ACCESS_TOKEN'];
  if (token === undefined || token.length === 0) {
    printTokenInstructions();
    return 1;
  }

  const mutate = process.env['SPLITWISE_FIXTURE_MUTATE'] === '1';

  if (mutate) {
    printMutativeWarning();
    await delay(5000);
  }

  await mkdir(FIXTURES_DIR, { recursive: true });

  const ctx: RunContext = {
    token,
    scrubMap: { values: new Map() },
    results: {
      succeeded: [],
      failed: [],
    },
  };

  // Bootstrap the scrub map from /get_current_user. Everything else hangs
  // off this — the rest of the run will scrub the user's name/email out of
  // every recorded response automatically.
  const currentUserBody = await bootstrapScrubMap(ctx);
  await delay(REQUEST_DELAY_MS);

  await runReadonlyPhase(ctx);
  if (mutate) {
    await runMutativePhase(ctx, currentUserBody);
  }

  process.stdout.write(
    `\nSummary: ${ctx.results.succeeded.length} succeeded, ${ctx.results.failed.length} failed.\n`,
  );
  if (ctx.results.failed.length > 0) {
    process.stdout.write('Failures:\n');
    for (const f of ctx.results.failed) {
      process.stdout.write(`  - ${f.name}: ${f.error}\n`);
    }
  }

  process.stdout.write(
    [
      '',
      `Auto-scrubbed: replaced the current user's first/last name and email`,
      `with placeholders, and replaced any access_token / add_friend_url /`,
      `invite_link field values. Fixtures may still contain other PII (other`,
      `users' names/emails in shared groups, expense descriptions, profile`,
      `picture URLs, etc.). Review every file in test/fixtures/ before`,
      `committing. Each fixture has \`_meta.reviewRequired: true\` until you`,
      `flip it to false.`,
      '',
    ].join('\n'),
  );

  return ctx.results.failed.length > 0 ? 1 : 0;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    process.stderr.write(`Unhandled error: ${message}\n`);
    process.exit(1);
  });
