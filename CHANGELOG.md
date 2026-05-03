# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-05-03

Complete rewrite in TypeScript. v2 is **not** backwards-compatible with v1; see
the migration guide at the bottom of this entry.

### Highlights

- **Full TypeScript** with strict types and `.d.ts` declarations for every
  export.
- **Zero runtime dependencies.** Uses native `fetch`, `crypto.subtle`, and
  `Blob`/`FormData`. Drops `oauth`, `ramda`, `validate.js`, `es6-promisify`,
  and `querystring`.
- **Resource-namespaced API** — `sw.expenses.list()`, `sw.groups.create()`,
  `sw.users.getCurrent()` — replacing the flat `sw.getExpenses()` style.
- **Two OAuth flows** — Client Credentials (v1's default) and the new
  Authorization Code + PKCE flow for end-user delegation.
- **Typed error hierarchy** — `instanceof` checks for auth/validation/rate
  limit/server/constraint failures.
- **Stripe-style** — throws on every API failure (including 200-with-errors
  responses); `delete()`/`restore()` return `Promise<void>` and rely on the
  absence of an exception as the success signal.
- **Lifecycle hooks** for observability (`onRequest`/`onResponse`/`onError`).
- **AbortSignal** + per-request `timeout`/`maxRetries`/`baseUrl` overrides on
  every method.
- **Async-iterable pagination** for `sw.expenses.list()`.
- **Receipt upload** via multipart on `sw.expenses.create({ receipt: blob })`.
- **`sw.rawRequest()`** escape hatch for endpoints not yet covered by the
  typed API.
- **Auto-generated User-Agent** identifying the SDK + optional `appInfo`.
- **CJS + ESM** dual build via plain `tsc` — works in Node 18+, Bun, Deno,
  Cloudflare Workers, modern browsers.

### Added

- TypeScript types for all 28 endpoints, request params, and response shapes.
- New error classes: `SplitwiseError` (base), `SplitwiseApiError`,
  `SplitwiseAuthenticationError` (401), `SplitwiseForbiddenError` (403),
  `SplitwiseNotFoundError` (404), `SplitwiseValidationError` (400),
  `SplitwiseRateLimitError` (429, with `retryAfter`),
  `SplitwiseServerError` (5xx), `SplitwiseConstraintError` (200 with
  `success:false` / non-empty `errors`), `SplitwiseConnectionError` (network).
- New `sw.expenses.restore()` and `sw.groups.restore()` (undelete endpoints,
  not present in v1).
- New `sw.comments.{list,create,delete}` resource (not present in v1).
- New `sw.expenses.create({ receipt: Blob })` for multipart receipt upload.
- New `sw.rawRequest(method, path, options)` escape hatch.
- New `sw.getAccessToken()` method (replaces v1's `sw.getAccessToken()` —
  same name, similar semantics, but now async and returns a string).
- New static auth helpers `Splitwise.createAuthorizationUrl()` and
  `Splitwise.fromAuthorizationCode()` for the Authorization Code + PKCE
  flow.
- New per-request overrides: every resource method takes an optional second
  argument with `signal`, `timeout`, `maxRetries`, `baseUrl`.
- New constructor options: `hooks` (request/response/error callbacks),
  `appInfo` (added to User-Agent header), `fetch` (injectable), `logger` /
  `logLevel`.
- New `NotificationType` constant + `notificationTypeName()` helper for
  decoding the numeric `Notification.type` field.
- Auto-pagination via async iterators on `sw.expenses.list()`.
- `SDK_VERSION` constant exported from the package root.

### Changed (breaking)

#### Method names and namespacing

| v1 | v2 |
|---|---|
| `sw.test()` | `sw.test()` (now returns `{clientId, token, requestUrl, params}` — it's a whoami, not a boolean) |
| `sw.getCurrentUser()` | `sw.users.getCurrent()` |
| `sw.getUser({id})` | `sw.users.get({id})` |
| `sw.updateUser({id, ...})` | `sw.users.update({id, ...})` |
| `sw.getGroups()` | `sw.groups.list()` |
| `sw.getGroup({id})` | `sw.groups.get({id})` |
| `sw.createGroup(...)` | `sw.groups.create(...)` |
| `sw.deleteGroup({id})` | `sw.groups.delete({id})` (now `Promise<void>`) |
| `sw.addUserToGroup(...)` | `sw.groups.addUser(...)` (returns `User`) |
| `sw.removeUserFromGroup(...)` | `sw.groups.removeUser(...)` (now `Promise<void>`) |
| `sw.getExpenses(...)` | `sw.expenses.list(...)` (returns `PagedResult`) |
| `sw.getExpense({id})` | `sw.expenses.get({id})` |
| `sw.createExpense(...)` | `sw.expenses.create(...)` |
| `sw.updateExpense({id, ...})` | `sw.expenses.update({id, ...})` |
| `sw.deleteExpense({id})` | `sw.expenses.delete({id})` (now `Promise<void>`) |
| `sw.getFriends()` | `sw.friends.list()` |
| `sw.getFriend({id})` | `sw.friends.get({id})` |
| `sw.createFriend(...)` | `sw.friends.create(...)` (only `userEmail` is required now) |
| `sw.createFriends(...)` | `sw.friends.createMultiple(...)` |
| `sw.deleteFriend({id})` | `sw.friends.delete({id})` (now `Promise<void>`) |
| `sw.getCurrencies()` | `sw.currencies.list()` |
| `sw.getCategories()` | `sw.categories.list()` |
| `sw.parseSentence(...)` | `sw.parseSentence(...)` (returns typed `ParseSentenceResponse` instead of `unknown`) |
| `sw.getNotifications(...)` | `sw.notifications.list(...)` |
| `sw.getMainData(...)` | `sw.getMainData(...)` (unchanged) |
| `sw.createDebt({from, to, ...})` | `sw.expenses.createDebt({paidBy, owedBy, ...})` (renamed args for clarity) |

#### Parameter and response shapes

- **All inputs and outputs use camelCase.** v1 surfaced the API's
  snake_case directly; v2 converts at the HTTP boundary.
- **`createDebt` arguments renamed**: `from` → `paidBy`, `to` → `owedBy`.
  Also, `amount` accepts `string | number` (v1 docs showed numbers but typed
  strings); `description` is now optional.
- **`ExpenseListParams.friendshipId` renamed to `friendId`.** v1's
  `friendship_id` was a bug — the actual API parameter is `friend_id`, so
  filter-by-friend has been silently broken since v1.
- **`friends.createMultiple` wire shape fixed.** v1 sent `friends__N__email`;
  the API expects `users__N__email`, and the response is `{users: [...]}`
  (not `{friends: [...]}`).
- **`friends.create` response shape fixed.** v1 expected
  `{friends: [theNewFriend]}`; the actual API returns `{friend: ...}` (singular).
  v1's `createFriend` was returning `undefined` for the new friend.
- **`update_expense` no longer accepts `splitEqually`** — the API rejects it
  with HTTP 400.
- **Delete/restore/membership endpoints return `Promise<void>`** instead of
  `Promise<{success: boolean}>`. The Stripe-style convention: an exception
  is the failure signal, no exception means success.
- **`addUser` returns the added `User` object** instead of `{success}`.
  Useful when adding by email — the API gives back the assigned user_id.
- **`sw.test()` returns `{clientId, token, requestUrl, params}`** instead of
  the v1 raw response. The endpoint is closer to a whoami than a generic
  health check.
- **Booleans converted to `0`/`1`** automatically in form bodies (v1
  required manual conversion).

#### Configuration

- **Promise-only API** — Node-style callbacks are no longer supported.
- **Default IDs removed.** v1 let you pass `group_id`, `user_id`,
  `expense_id`, or `friend_id` to the constructor and have them applied
  implicitly. v2 requires explicit IDs on every method call. Passing any of
  these to the constructor now throws `TypeError` with a migration hint.
- **Logger interface changed.** v1 accepted a function; v2 requires a
  `{debug, info, warn, error}` object. v1's `logLevel: 'error' | 'info'`
  becomes `'none' | 'error' | 'warn' | 'info' | 'debug'` in v2.
- **OAuth header changed from `OAuth` to `Bearer`** (the modern OAuth2
  convention).
- **Retry behavior**: now uses exponential backoff with jitter, honors
  `Retry-After`, retries 429/5xx/connection failures by default. v1 had no
  retry.

### Removed (breaking)

- The old `validate.js` runtime parameter validation. TypeScript types
  enforce shape at compile time; runtime validation is the API's job.
- The `creation_method` parameter restriction list. v2 accepts the field
  as an arbitrary string (verified to round-trip through the API).
- Support for Node < 18.
- All v1 dependencies (`oauth`, `ramda`, `validate.js`, `es6-promisify`,
  `querystring`).

### Internal

- Vitest replaces Jest. ESLint dropped (use the user's editor/CI config).
- Plain `tsc` builds (no bundler) into `dist/cjs/` and `dist/esm/`.
- Fixture-driven integration tests: `scripts/generate-fixtures.ts` records
  real API responses (with automatic PII scrubbing); 21 integration tests
  replay them through the SDK.
- 254 tests, type-check clean, both build outputs verified.

### Migration guide

Most upgrades are mechanical — search/replace the renamed methods and
update any constructor options.

```typescript
// v1
const Splitwise = require('splitwise');
const sw = Splitwise({
  consumerKey: process.env.SPLITWISE_KEY,
  consumerSecret: process.env.SPLITWISE_SECRET,
  group_id: 12345,  // <-- removed in v2
});
const me = await sw.getCurrentUser();
const expenses = await sw.getExpenses({ limit: 50 });
const { success } = await sw.deleteExpense({ id: 999 });

// v2
import { Splitwise, SplitwiseConstraintError } from 'splitwise';
const sw = new Splitwise({
  consumerKey: process.env.SPLITWISE_KEY,
  consumerSecret: process.env.SPLITWISE_SECRET,
  // No default IDs — pass them per call.
});
const me = await sw.users.getCurrent();
const expenses = await sw.expenses.list({ groupId: 12345, limit: 50 });
try {
  await sw.expenses.delete({ id: 999 });  // void on success
} catch (err) {
  if (err instanceof SplitwiseConstraintError) {
    // ...the API said this delete couldn't happen
  }
}
```

For the Authorization Code + PKCE flow (new in v2):

```typescript
// 1. Generate the redirect URL
const auth = await Splitwise.createAuthorizationUrl({
  clientId: process.env.SPLITWISE_KEY!,
  redirectUri: 'http://localhost:3000/callback',
});
// Send the user to auth.url. Persist auth.state and auth.codeVerifier.

// 2. After the user returns to your callback with a `code`:
const sw = await Splitwise.fromAuthorizationCode({
  clientId: process.env.SPLITWISE_KEY!,
  clientSecret: process.env.SPLITWISE_SECRET!,
  code,                        // from callback query string
  codeVerifier: auth.codeVerifier,  // from your session
  redirectUri: 'http://localhost:3000/callback',
});
```

---

## Pre-2.0.0

See git history for v1 changes. v1 was JavaScript-only, never published a
formal CHANGELOG.
