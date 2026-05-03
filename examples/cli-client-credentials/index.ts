/**
 * CLI demo: print a summary of the authenticated user's Splitwise account.
 *
 * Demonstrates:
 *   - Client Credentials OAuth flow (no user redirect)
 *   - Token caching (one /oauth/token call powers many API calls)
 *   - Resource-namespaced API (sw.users, sw.groups, sw.expenses)
 *   - PagedResult: async iteration over expenses
 *   - Hooks: verbose request logging behind a --verbose flag
 *   - Typed errors: friendly messages on auth failures
 *
 * Usage:
 *   SPLITWISE_CONSUMER_KEY=...    \
 *   SPLITWISE_CONSUMER_SECRET=... \
 *     npm start                          # (or: npx tsx index.ts)
 *
 *   With verbose request logging:
 *     SPLITWISE_VERBOSE=1 npm start
 */

import process from 'node:process';
import {
  Splitwise,
  SplitwiseAuthenticationError,
  SplitwiseError,
} from 'splitwise';

const consumerKey = process.env['SPLITWISE_CONSUMER_KEY'];
const consumerSecret = process.env['SPLITWISE_CONSUMER_SECRET'];

if (consumerKey === undefined || consumerSecret === undefined) {
  process.stderr.write(
    [
      'Missing credentials.',
      '',
      'Get a consumer key/secret by registering an app at',
      '  https://secure.splitwise.com/apps',
      'and re-run with:',
      '  SPLITWISE_CONSUMER_KEY=... SPLITWISE_CONSUMER_SECRET=... npm start',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const verbose = process.env['SPLITWISE_VERBOSE'] === '1';

const sw = new Splitwise({
  consumerKey,
  consumerSecret,
  appInfo: {
    name: 'splitwise-cli-example',
    version: '0.0.0',
    url: 'https://github.com/keriwarr/splitwise/tree/master/examples/cli-client-credentials',
  },
  ...(verbose && {
    hooks: {
      onRequest: ({ method, url, attempt }) => {
        const tag = attempt > 1 ? ` (retry ${attempt - 1})` : '';
        process.stderr.write(`→ ${method} ${url}${tag}\n`);
      },
      onResponse: ({ status, durationMs }) => {
        process.stderr.write(`← ${status} (${durationMs}ms)\n`);
      },
    },
  }),
});

async function main(): Promise<void> {
  // Splitwise stores money as strings; format consistently for the CLI.
  const fmt = (amount: string, currency: string): string =>
    `${amount} ${currency}`;

  const me = await sw.users.getCurrent();
  const heading = `${me.firstName}${me.lastName !== null ? ` ${me.lastName}` : ''} (${me.email})`;
  console.log(heading);
  console.log('='.repeat(heading.length));
  console.log(`Default currency: ${me.defaultCurrency}`);
  console.log(`Locale:           ${me.locale}`);
  console.log();

  const groups = await sw.groups.list();
  // Filter out the always-present "Non-group expenses" pseudo-group.
  const realGroups = groups.filter((g) => g.id !== 0);
  console.log(`Groups (${realGroups.length}):`);
  if (realGroups.length === 0) {
    console.log('  (none)');
  } else {
    for (const group of realGroups) {
      console.log(`  • ${group.name} [${group.members?.length ?? 0} members]`);
    }
  }
  console.log();

  const friends = await sw.friends.list();
  console.log(`Friends (${friends.length}):`);
  if (friends.length === 0) {
    console.log('  (none)');
  } else {
    for (const friend of friends) {
      const name = `${friend.firstName}${friend.lastName !== null ? ` ${friend.lastName}` : ''}`;
      const balanceSummary =
        friend.balance.length > 0
          ? friend.balance.map((b) => fmt(b.amount, b.currencyCode)).join(', ')
          : 'settled';
      console.log(`  • ${name} — ${balanceSummary}`);
    }
  }
  console.log();

  // Async-iterate the most recent expenses. The PagedResult walks pages of 100
  // behind the scenes; we cap at 5 here for a tidy CLI summary.
  console.log('Recent expenses:');
  let count = 0;
  for await (const expense of sw.expenses.list()) {
    if (count >= 5) break;
    const description = expense.description || '(no description)';
    const cost = fmt(expense.cost, expense.currencyCode);
    const date = expense.date.split('T')[0];
    console.log(`  • ${date}  ${cost.padStart(14)}  ${description}`);
    count += 1;
  }
  if (count === 0) {
    console.log('  (no expenses)');
  }
}

main().catch((err: unknown) => {
  if (err instanceof SplitwiseAuthenticationError) {
    process.stderr.write(`\nAuthentication failed: ${err.message}\n`);
    process.stderr.write(
      'Double-check SPLITWISE_CONSUMER_KEY and SPLITWISE_CONSUMER_SECRET.\n',
    );
    process.exit(1);
  }
  if (err instanceof SplitwiseError) {
    process.stderr.write(`\nSplitwise error: ${err.message}\n`);
    process.exit(1);
  }
  throw err;
});
