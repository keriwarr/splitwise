# cli-client-credentials

Minimal CLI demo for the Splitwise SDK. Prints a summary of the
authenticated user's account: profile, groups, friends, and the most recent
expenses.

Uses the **Client Credentials** OAuth flow — no user redirect, no callback
URL. The app token gives you access to the data of whoever owns the
registered Splitwise app (i.e. you).

## Setup

1. Register an app at <https://secure.splitwise.com/apps>. Any callback URL
   is fine; this example doesn't use one.
2. Copy the **Consumer Key** and **Consumer Secret** from the app page.
3. Install dependencies and run:

   ```bash
   cd examples/cli-client-credentials
   npm install
   SPLITWISE_CONSUMER_KEY=xxx SPLITWISE_CONSUMER_SECRET=yyy npm start
   ```

## Verbose mode

To see every HTTP request the SDK makes, set `SPLITWISE_VERBOSE=1`:

```bash
SPLITWISE_VERBOSE=1 SPLITWISE_CONSUMER_KEY=... SPLITWISE_CONSUMER_SECRET=... npm start
```

This wires up the SDK's `onRequest` and `onResponse` hooks and prints a line
per HTTP call with method, URL, status, and duration. Note: the
`Authorization` header is automatically redacted in hook events, so it's safe
to log.

## What this demonstrates

- **Client Credentials flow**: just pass `consumerKey` + `consumerSecret`;
  the SDK handles the token fetch.
- **Token caching**: the OAuth token is fetched once and reused across all
  the API calls. Watch the verbose output — there's exactly one
  `/oauth/token` call.
- **Resource-namespaced API**: `sw.users.getCurrent()`, `sw.groups.list()`,
  etc.
- **Async-iterable pagination**: `for await (const expense of sw.expenses.list())`
  walks pages transparently.
- **Hooks**: per-request logging via the constructor's `hooks` option.
- **Typed errors**: bad credentials produce a friendly message via
  `SplitwiseAuthenticationError` rather than a generic stack trace.
- **`appInfo`**: identifies this example in the User-Agent header.
