/**
 * Web demo: log in with Splitwise via the Authorization Code + PKCE flow,
 * then show the authenticated user's groups and recent expenses.
 *
 * Demonstrates:
 *   - Splitwise.createAuthorizationUrl() — building the consent URL with PKCE
 *   - State + codeVerifier persistence (express-session here; cookies / KV
 *     / database in a real app)
 *   - Splitwise.fromAuthorizationCode() — exchanging the callback code for
 *     a token
 *   - sw.getOAuthToken() — pulling the full token (with expiry/refresh
 *     metadata) for persistence between page loads
 *   - Resource API + async-iterable pagination on the dashboard
 *   - Typed errors (SplitwiseConstraintError, SplitwiseAuthenticationError)
 *
 * Setup:
 *   1. Register a Splitwise app at https://secure.splitwise.com/apps
 *      Set the callback URL to:  http://localhost:3000/auth/callback
 *      Copy the consumer key + secret.
 *   2. From this directory:
 *        npm install
 *        SPLITWISE_CONSUMER_KEY=...   \
 *        SPLITWISE_CONSUMER_SECRET=...\
 *        SESSION_SECRET=any-random-string \
 *          npm start
 *   3. Open http://localhost:3000 in your browser.
 *
 * SECURITY NOTE: this is a demo. In production you'd want HTTPS, a real
 * session store (not the default in-memory one), CSRF protection on the POST
 * routes, etc. The Splitwise SDK itself uses PKCE + state correctly; the
 * rough edges here are in the surrounding web plumbing, not the SDK.
 */

import process from 'node:process';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import {
  Splitwise,
  SplitwiseAuthenticationError,
  type OAuthToken,
} from 'splitwise';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = `http://localhost:${PORT}`;
const REDIRECT_URI = `${HOST}/auth/callback`;

const consumerKey = process.env['SPLITWISE_CONSUMER_KEY'];
const consumerSecret = process.env['SPLITWISE_CONSUMER_SECRET'];
const sessionSecret = process.env['SESSION_SECRET'];

if (
  consumerKey === undefined ||
  consumerSecret === undefined ||
  sessionSecret === undefined
) {
  process.stderr.write(
    [
      'Missing config. Set:',
      '  SPLITWISE_CONSUMER_KEY     (from https://secure.splitwise.com/apps)',
      '  SPLITWISE_CONSUMER_SECRET  (from same place)',
      '  SESSION_SECRET             (any random string for express-session)',
      '',
      `Make sure your Splitwise app's callback URL is set to:`,
      `  ${REDIRECT_URI}`,
      '',
    ].join('\n'),
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Session typing
// ---------------------------------------------------------------------------

declare module 'express-session' {
  interface SessionData {
    /** Pending OAuth state — set on /login, consumed on /auth/callback. */
    oauth?: { state: string; codeVerifier: string };
    /** Persisted token after a successful exchange. */
    token?: OAuthToken;
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Demo only -- set secure: true and use HTTPS in production.
      httpOnly: true,
      sameSite: 'lax',
    },
  }),
);

/** Build a Splitwise client from a stored OAuthToken. */
function clientFromToken(token: OAuthToken): Splitwise {
  return new Splitwise({ accessToken: token.accessToken });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/', (req, res) => {
  if (req.session.token === undefined) {
    res.send(homePage());
    return;
  }
  res.redirect('/dashboard');
});

/**
 * Generate a Splitwise authorization URL and redirect the user.
 * Persists the SDK-generated state + codeVerifier on the session for the
 * callback handler to consume.
 */
app.get('/login', async (req, res, next) => {
  try {
    const auth = await Splitwise.createAuthorizationUrl({
      clientId: consumerKey,
      redirectUri: REDIRECT_URI,
    });
    req.session.oauth = {
      state: auth.state,
      codeVerifier: auth.codeVerifier,
    };
    // Force the session write before redirecting -- otherwise the user can
    // race back from Splitwise before we've persisted the verifier.
    req.session.save((err) => {
      if (err !== null && err !== undefined) {
        next(err);
        return;
      }
      res.redirect(auth.url);
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Splitwise redirects here with `?code=...&state=...`. We:
 *   1. Verify the returned `state` matches what we stored on /login (CSRF).
 *   2. Exchange the code + the original codeVerifier for an access token.
 *   3. Stash the token on the session and redirect to the dashboard.
 */
app.get('/auth/callback', async (req, res, next) => {
  try {
    const code = typeof req.query['code'] === 'string' ? req.query['code'] : null;
    const state = typeof req.query['state'] === 'string' ? req.query['state'] : null;
    const errorParam =
      typeof req.query['error'] === 'string' ? req.query['error'] : null;

    if (errorParam !== null) {
      res
        .status(400)
        .send(errorPage(`Splitwise denied the authorization: ${errorParam}`));
      return;
    }
    if (code === null || state === null) {
      res.status(400).send(errorPage('Missing code or state in callback.'));
      return;
    }

    const pending = req.session.oauth;
    if (pending === undefined) {
      res
        .status(400)
        .send(
          errorPage(
            'No pending OAuth flow on this session. Start over from /login.',
          ),
        );
      return;
    }
    if (state !== pending.state) {
      res
        .status(400)
        .send(
          errorPage(
            'OAuth state mismatch — possible CSRF. Start over from /login.',
          ),
        );
      return;
    }

    const sw = await Splitwise.fromAuthorizationCode({
      clientId: consumerKey,
      clientSecret: consumerSecret,
      code,
      codeVerifier: pending.codeVerifier,
      redirectUri: REDIRECT_URI,
    });

    // Pull the full OAuthToken (preserves expiry + refresh metadata) so
    // we can reuse it across page loads without re-doing the OAuth flow.
    const token = sw.getOAuthToken();
    if (token === undefined) {
      // Shouldn't happen for fromAuthorizationCode, but be defensive.
      throw new Error('Splitwise returned no token');
    }

    req.session.oauth = undefined;
    req.session.token = token;
    req.session.save((err) => {
      if (err !== null && err !== undefined) {
        next(err);
        return;
      }
      res.redirect('/dashboard');
    });
  } catch (err) {
    if (err instanceof SplitwiseAuthenticationError) {
      res.status(401).send(errorPage(`OAuth exchange failed: ${err.message}`));
      return;
    }
    next(err);
  }
});

/** The post-login view. Shows the user, their groups, and recent expenses. */
app.get('/dashboard', async (req, res, next) => {
  if (req.session.token === undefined) {
    res.redirect('/');
    return;
  }
  try {
    const sw = clientFromToken(req.session.token);

    // Run the four reads in parallel -- they share one OAuth token, so this
    // is just three real GETs (plus the no-op token cache hit).
    const [me, groups, friends, recentExpenses] = await Promise.all([
      sw.users.getCurrent(),
      sw.groups.list(),
      sw.friends.list(),
      collectFirst(sw.expenses.list(), 10),
    ]);

    res.send(dashboardPage({ me, groups, friends, expenses: recentExpenses }));
  } catch (err) {
    if (err instanceof SplitwiseAuthenticationError) {
      // Token revoked / expired -- nuke the session and bounce to /.
      req.session.token = undefined;
      res.redirect('/');
      return;
    }
    next(err);
  }
});

app.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err !== null && err !== undefined) {
      next(err);
      return;
    }
    res.redirect('/');
  });
});

// Generic error handler. Keeps /dashboard etc. clean of try/catch.
app.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    process.stderr.write(`server error: ${err.stack ?? err.message}\n`);
    res.status(500).send(errorPage(`Server error: ${err.message}`));
  },
);

app.listen(PORT, () => {
  process.stdout.write(`Splitwise demo running at ${HOST}\n`);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Async-iterable -> array, capped at `limit` items. Useful for the dashboard
 * where we only want the most recent expenses.
 */
async function collectFirst<T>(
  iter: AsyncIterable<T>,
  limit: number,
): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) {
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** Minimal HTML escape so user-controlled strings can't inject markup. */
function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Pages (inline so the demo is self-contained)
// ---------------------------------------------------------------------------

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    body { font: 16px/1.5 system-ui, -apple-system, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; color: #222; }
    h1 { margin-top: 0; }
    h2 { margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
    a.btn, button.btn { display: inline-block; padding: 0.5rem 1rem; background: #1cc29f; color: white; border: 0; border-radius: 4px; text-decoration: none; cursor: pointer; font: inherit; }
    a.btn:hover, button.btn:hover { background: #19a98c; }
    ul { padding-left: 1.5rem; }
    .meta { color: #666; font-size: 0.9em; }
    .err { background: #fee; border: 1px solid #f99; padding: 1rem; border-radius: 4px; }
    table { border-collapse: collapse; width: 100%; }
    td { padding: 0.25rem 0.5rem; border-bottom: 1px solid #eee; }
    td.amount { text-align: right; font-variant-numeric: tabular-nums; }
    form { display: inline; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function homePage(): string {
  return shell(
    'Splitwise SDK demo',
    `
    <h1>Splitwise SDK demo</h1>
    <p>This little app uses the
      <a href="https://github.com/keriwarr/splitwise">splitwise</a> SDK's
      Authorization Code + PKCE flow to log you in with your Splitwise account.</p>
    <p>Click below to start. You'll be redirected to Splitwise to grant access,
      then back here to see your data.</p>
    <p><a class="btn" href="/login">Log in with Splitwise</a></p>
    `,
  );
}

function errorPage(message: string): string {
  return shell(
    'Error',
    `
    <h1>Something went wrong</h1>
    <p class="err">${esc(message)}</p>
    <p><a href="/">Back to start</a></p>
    `,
  );
}

interface DashboardArgs {
  me: { firstName: string; lastName: string | null; email: string; defaultCurrency: string };
  groups: Array<{ id: number; name: string; members?: Array<unknown> }>;
  friends: Array<{
    id: number;
    firstName: string;
    lastName: string | null;
    balance: Array<{ amount: string; currencyCode: string }>;
  }>;
  expenses: Array<{
    id: number;
    description: string;
    cost: string;
    currencyCode: string;
    date: string;
  }>;
}

function dashboardPage(args: DashboardArgs): string {
  const { me, groups, friends, expenses } = args;
  const realGroups = groups.filter((g) => g.id !== 0);
  const heading = `${me.firstName}${me.lastName !== null ? ` ${me.lastName}` : ''}`;

  const groupsList =
    realGroups.length > 0
      ? `<ul>${realGroups
          .map(
            (g) =>
              `<li>${esc(g.name)} <span class="meta">(${g.members?.length ?? 0} members)</span></li>`,
          )
          .join('')}</ul>`
      : `<p class="meta">No groups.</p>`;

  const friendsList =
    friends.length > 0
      ? `<ul>${friends
          .map((f) => {
            const name = `${f.firstName}${f.lastName !== null ? ` ${f.lastName}` : ''}`;
            const balance =
              f.balance.length > 0
                ? f.balance
                    .map((b) => `${esc(b.amount)} ${esc(b.currencyCode)}`)
                    .join(', ')
                : 'settled';
            return `<li>${esc(name)} <span class="meta">— ${balance}</span></li>`;
          })
          .join('')}</ul>`
      : `<p class="meta">No friends.</p>`;

  const expensesTable =
    expenses.length > 0
      ? `<table>${expenses
          .map((e) => {
            const date = e.date.split('T')[0] ?? '';
            return `<tr>
              <td class="meta">${esc(date)}</td>
              <td>${esc(e.description || '(no description)')}</td>
              <td class="amount">${esc(e.cost)} ${esc(e.currencyCode)}</td>
            </tr>`;
          })
          .join('')}</table>`
      : `<p class="meta">No recent expenses.</p>`;

  return shell(
    `${heading} — Splitwise demo`,
    `
    <h1>Hello, ${esc(heading)}</h1>
    <p class="meta">${esc(me.email)} · default currency ${esc(me.defaultCurrency)}</p>
    <form method="POST" action="/logout"><button class="btn" type="submit">Log out</button></form>

    <h2>Groups</h2>
    ${groupsList}

    <h2>Friends</h2>
    ${friendsList}

    <h2>Recent expenses</h2>
    ${expensesTable}
    `,
  );
}

