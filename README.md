# Splitwise SDK

A TypeScript SDK for the [Splitwise API](https://dev.splitwise.com). Zero runtime dependencies, full TypeScript types, supports both Client Credentials and Authorization Code (PKCE) OAuth flows.

## Install

```shell
npm install splitwise
# or
yarn add splitwise
```

Requires Node.js 18 or newer (the SDK uses the global `fetch` and Web Crypto APIs).

## Quick start

```typescript
import { Splitwise } from 'splitwise';

const sw = new Splitwise({
  consumerKey: process.env.SPLITWISE_CONSUMER_KEY,
  consumerSecret: process.env.SPLITWISE_CONSUMER_SECRET,
});

const me = await sw.users.getCurrent();
console.log(`Hi, ${me.firstName}!`);
```

## What's new in v2

v2 is a ground-up rewrite. If you're upgrading from v1, see [Migrating from v1](#migrating-from-v1) below. The highlights:

- Resource-namespaced API (`sw.expenses.list()`, `sw.users.getCurrent()`, ...).
- Full TypeScript types for every request and response.
- camelCase throughout — no more `group_id` or `paid_share`.
- Promise-only API (no callbacks).
- Authorization Code + PKCE flow for end-user access, in addition to Client Credentials.
- Typed error hierarchy with automatic retry for transient failures.
- Async-iterable pagination on list endpoints.
- Zero runtime dependencies.

## Authentication

The SDK supports three ways to authenticate.

### 1. Pre-obtained access token

The simplest option — useful when you've already obtained a token (e.g. you cached one from a previous run, or you obtained it through a separate flow).

```typescript
const sw = new Splitwise({ accessToken: 'sw_abc123...' });
```

### 2. Client Credentials

Use this to access **the app owner's** data (i.e. the developer who registered the app). The SDK fetches an access token automatically on first use and caches it in memory.

```typescript
const sw = new Splitwise({
  consumerKey: process.env.SPLITWISE_CONSUMER_KEY,
  consumerSecret: process.env.SPLITWISE_CONSUMER_SECRET,
});
```

If you'd like to obtain the token explicitly (e.g. to persist it across process restarts), call `sw.getAccessToken()`:

```typescript
const token = await sw.getAccessToken();
// store `token` somewhere safe, then later:
const sw2 = new Splitwise({ accessToken: token });
```

### 3. Authorization Code with PKCE

Use this to access **end-user data** — your application redirects the user through Splitwise's consent screen, then exchanges the returned code for an access token tied to that user. PKCE is enforced.

The SDK does **not** run a redirect server — your application is responsible for handling the OAuth callback URL.

```typescript
import { Splitwise } from 'splitwise';

// Step 1: build the authorization URL and persist `state` + `codeVerifier`
// (e.g. in the user's session). Then redirect the user to `url`.
const auth = await Splitwise.createAuthorizationUrl({
  clientId: process.env.SPLITWISE_CLIENT_ID!,
  redirectUri: 'https://example.com/oauth/callback',
});

// session.state = auth.state;
// session.codeVerifier = auth.codeVerifier;
// res.redirect(auth.url);

// Step 2: in your callback handler, verify `state` matches what you stored,
// then exchange the code for a fully configured Splitwise client.
const sw = await Splitwise.fromAuthorizationCode({
  clientId: process.env.SPLITWISE_CLIENT_ID!,
  clientSecret: process.env.SPLITWISE_CLIENT_SECRET!,
  code: req.query.code as string,
  codeVerifier: session.codeVerifier,
  redirectUri: 'https://example.com/oauth/callback',
});

const me = await sw.users.getCurrent();
```

`Splitwise.fromAuthorizationCode` accepts an optional second argument with any non-auth `SplitwiseConfig` options (e.g. `timeout`, `logger`).

## API reference

For the underlying API surface and detailed parameter semantics, see the [official Splitwise API docs](https://dev.splitwise.com).

### Expenses — `sw.expenses`

| Method | Description |
|---|---|
| `list(params?: ExpenseListParams): PagedResult<Expense>` | List expenses (paginated). Filterable by `groupId`, `friendshipId`, date range, etc. |
| `get(params: { id }): Promise<Expense>` | Fetch a single expense. |
| `create(params: ExpenseCreateParams): Promise<Expense>` | Create an expense. |
| `update(params: ExpenseUpdateParams): Promise<Expense>` | Update an existing expense by `id`. |
| `delete(params: { id }): Promise<void>` | Delete an expense (soft delete). Throws `SplitwiseConstraintError` on domain failure. |
| `restore(params: { id }): Promise<void>` | Restore a soft-deleted expense. |
| `createDebt(params: CreateDebtParams): Promise<Expense>` | Convenience helper for the common "user A owes user B X" case. |

```typescript
// Create a $25 dinner expense, split equally between three users
const expense = await sw.expenses.create({
  cost: '25.00',
  description: 'Dinner',
  groupId: 12345,
  splitEqually: true,
});

// Convenience: record that user 42 owes user 23 ten dollars (user 23 paid for it)
await sw.expenses.createDebt({
  paidBy: 23,
  owedBy: 42,
  amount: 10,
  description: 'Coffee',
  groupId: 12345,
});
```

### Groups — `sw.groups`

| Method | Description |
|---|---|
| `list(): Promise<Group[]>` | List the current user's groups. |
| `get(params: { id }): Promise<Group>` | Fetch a single group. |
| `create(params: GroupCreateParams): Promise<Group>` | Create a new group. |
| `delete(params: { id }): Promise<void>` | Delete a group. Throws `SplitwiseConstraintError` on domain failure. |
| `restore(params: { id }): Promise<void>` | Restore a deleted group. |
| `addUser(params: AddUserToGroupParams): Promise<User>` | Add a user to a group (by `userId` or by name + email). Returns the added user. |
| `removeUser(params: { groupId, userId }): Promise<void>` | Remove a user from a group. |

### Users — `sw.users`

| Method | Description |
|---|---|
| `getCurrent(): Promise<CurrentUser>` | Fetch the authenticated user. |
| `get(params: { id }): Promise<User>` | Fetch any user by id. |
| `update(params: UserUpdateParams): Promise<User>` | Update a user's profile fields. |

### Friends — `sw.friends`

| Method | Description |
|---|---|
| `list(): Promise<Friend[]>` | List the current user's friends. |
| `get(params: { id }): Promise<Friend>` | Fetch one friend. |
| `create(params: FriendCreateParams): Promise<Friend>` | Add a friend by email. |
| `createMultiple(params: FriendCreateMultipleParams): Promise<Friend[]>` | Add several friends at once. |
| `delete(params: { id }): Promise<void>` | Remove a friend. Throws `SplitwiseConstraintError` if the friendship has unsettled debts. |

### Comments — `sw.comments`

| Method | Description |
|---|---|
| `list(params: { expenseId }): Promise<Comment[]>` | List comments on an expense. |
| `create(params: { expenseId, content }): Promise<Comment>` | Post a comment on an expense. |
| `delete(params: { id }): Promise<Comment>` | Delete a comment (returns the deleted comment). |

### Notifications — `sw.notifications`

| Method | Description |
|---|---|
| `list(params?: NotificationListParams): Promise<Notification[]>` | List notifications, optionally filtered by `updatedAfter`. |

### Currencies — `sw.currencies`

| Method | Description |
|---|---|
| `list(): Promise<Currency[]>` | List all currencies supported by Splitwise. |

### Categories — `sw.categories`

| Method | Description |
|---|---|
| `list(): Promise<Category[]>` | List all expense categories (with their subcategories). |

### Top-level utilities

| Method | Description |
|---|---|
| `sw.test(): Promise<{ clientId, token, requestUrl, params }>` | "Whoami" endpoint: returns the authenticated client's id and token info. |
| `sw.parseSentence(params: ParseSentenceParams): Promise<ParseSentenceResponse>` | Parse a natural-language description (e.g. "I owe Bob $10") into an expense. |
| `sw.getMainData(params?: GetMainDataParams): Promise<unknown>` | Bulk fetch user, groups, friends, currencies, and categories in one call. |
| `sw.getAccessToken(): Promise<string>` | Return the current access token (fetching one via Client Credentials if needed). |

## Pagination

`sw.expenses.list()` returns a `PagedResult<Expense>` that can be used three ways. Other resources currently return plain arrays.

**Await it for the first page** — sends your `limit` as-is, so the server's default applies if you omit it. Repeated awaits return the cached result.

```typescript
const firstPage = await sw.expenses.list({ groupId: 12345, limit: 50 });
```

**Async-iterate to walk every item** — the SDK pages behind the scenes (default page size 100; honors your `limit` if set).

```typescript
for await (const expense of sw.expenses.list({ groupId: 12345 })) {
  console.log(expense.description, expense.cost);
}
```

**Iterate page-by-page** with `byPage()`:

```typescript
for await (const page of sw.expenses.list({ groupId: 12345 }).byPage()) {
  console.log(`Got ${page.length} expenses`);
}
```

## Error handling

Every error thrown by the SDK extends `SplitwiseError`. HTTP errors are mapped to specific subclasses so you can branch on `instanceof`:

```
SplitwiseError
├── SplitwiseApiError              (any failure response from the API)
│   ├── SplitwiseValidationError       (400)
│   ├── SplitwiseAuthenticationError   (401)
│   ├── SplitwiseForbiddenError        (403)
│   ├── SplitwiseNotFoundError         (404)
│   ├── SplitwiseRateLimitError        (429)
│   ├── SplitwiseServerError           (5xx)
│   └── SplitwiseConstraintError       (200 with success:false / non-empty errors)
└── SplitwiseConnectionError       (network failures)
```

`SplitwiseConstraintError` covers cases where the API returns HTTP 200 but the operation didn't actually happen — typically because of a domain rule (e.g. trying to delete a friend with whom you have an unsettled balance). Following the Stripe pattern, the SDK throws on these rather than returning the failure as data, so `delete()`-style methods can have a clean `Promise<void>` return type and callers don't need to remember to check a `success` field.

```typescript
import {
  Splitwise,
  SplitwiseAuthenticationError,
  SplitwiseConstraintError,
  SplitwiseRateLimitError,
  SplitwiseNotFoundError,
} from 'splitwise';

try {
  const expense = await sw.expenses.get({ id: 999 });
} catch (err) {
  if (err instanceof SplitwiseNotFoundError) {
    // ...the expense doesn't exist or isn't visible to this user
  } else if (err instanceof SplitwiseAuthenticationError) {
    // ...token is invalid or expired
  } else if (err instanceof SplitwiseRateLimitError) {
    // `retryAfter` is the value of the Retry-After header in seconds, if present
    await sleep((err.retryAfter ?? 1) * 1000);
  } else {
    throw err;
  }
}

// Domain failure example: trying to delete a friend with unsettled debts
try {
  await sw.friends.delete({ id: 12345 });
} catch (err) {
  if (err instanceof SplitwiseConstraintError) {
    // err.message: "You cannot delete this friendship; you have unsettled debts"
    // err.raw: full response body for inspection
    showUserMessage(err.message);
  }
}
```

`SplitwiseApiError` carries the HTTP `statusCode`, an SDK-assigned error `code`, and the unparsed `raw` response body for inspection. `SplitwiseConnectionError` exposes the underlying network error as `cause`.

The SDK automatically retries transient failures (network errors, 429s, and 5xx responses) up to `maxRetries` times with exponential backoff before throwing.

## Configuration options

`new Splitwise(config)` accepts the following options:

| Option | Type | Default | Description |
|---|---|---|---|
| `consumerKey` | `string` | — | OAuth consumer key. Required when `accessToken` is not provided. |
| `consumerSecret` | `string` | — | OAuth consumer secret. Required when `accessToken` is not provided. |
| `accessToken` | `string` | — | Pre-obtained access token. If set, the SDK skips the OAuth flow entirely. |
| `baseUrl` | `string` | `https://secure.splitwise.com/api/v3.0` | Override the API base URL (useful for testing). |
| `maxRetries` | `number` | `2` | Maximum automatic retries for transient failures. |
| `timeout` | `number` | `30000` | Per-request timeout in milliseconds. |
| `logger` | `Logger` | — | Custom logger; the SDK never calls `console.*` directly. Implements `{ debug, info, warn, error }`. |
| `logLevel` | `'none' \| 'error' \| 'warn' \| 'info' \| 'debug'` | `'none'` | Filter logs at or below this level. |
| `fetch` | `typeof fetch` | global `fetch` | Inject a custom `fetch` implementation (useful for testing). |

You must provide either `accessToken` or both `consumerKey` and `consumerSecret`.

## Migrating from v1

v2 is a breaking API change end-to-end. The mapping is mostly mechanical, but read carefully:

- **Resource namespaces.** All methods have moved under resource objects.

  | v1 | v2 |
  |---|---|
  | `sw.getCurrentUser()` | `sw.users.getCurrent()` |
  | `sw.getUser({ id })` | `sw.users.get({ id })` |
  | `sw.getGroups()` | `sw.groups.list()` |
  | `sw.getGroup({ id })` | `sw.groups.get({ id })` |
  | `sw.createGroup(...)` | `sw.groups.create(...)` |
  | `sw.deleteGroup({ id })` | `sw.groups.delete({ id })` |
  | `sw.addUserToGroup(...)` | `sw.groups.addUser(...)` |
  | `sw.removeUserFromGroup(...)` | `sw.groups.removeUser(...)` |
  | `sw.getExpenses(...)` | `sw.expenses.list(...)` |
  | `sw.getExpense({ id })` | `sw.expenses.get({ id })` |
  | `sw.createExpense(...)` | `sw.expenses.create(...)` |
  | `sw.updateExpense(...)` | `sw.expenses.update(...)` |
  | `sw.deleteExpense({ id })` | `sw.expenses.delete({ id })` |
  | `sw.getFriends()` | `sw.friends.list()` |
  | `sw.getNotifications()` | `sw.notifications.list()` |
  | `sw.getCurrencies()` | `sw.currencies.list()` |
  | `sw.getCategories()` | `sw.categories.list()` |
  | `sw.createDebt(...)` | `sw.expenses.createDebt(...)` |

- **camelCase everywhere.** All inputs and outputs use camelCase. `group_id` becomes `groupId`, `paid_share` becomes `paidShare`, `default_currency` becomes `defaultCurrency`, and so on. The SDK converts to and from the API's snake_case at the HTTP boundary.

- **Promise-only.** The optional callback argument is gone. All methods return Promises.

- **Default IDs removed.** v1 let you pass `group_id`, `user_id`, `expense_id`, or `friend_id` to the constructor and have them applied implicitly. v2 requires explicit IDs on every method call. Passing any of these to the constructor now throws `TypeError` with a migration hint.

- **`sw.test()` returns an object.** It now returns `{ success: boolean }` instead of the raw API response.

- **Delete and membership endpoints return `{ success: boolean }`.** `sw.expenses.delete`, `sw.expenses.restore`, `sw.groups.delete`, `sw.groups.restore`, `sw.groups.addUser`, `sw.groups.removeUser`, and `sw.friends.delete` all return `{ success: boolean }` instead of a bare boolean.

- **TypeScript types throughout.** Every request and response is fully typed. You no longer need a separate `@types/splitwise` package.

- **Zero runtime dependencies.** v2 uses the platform `fetch` and Web Crypto APIs and has no `dependencies` in `package.json`.

- **New: end-user OAuth.** v2 ships an Authorization Code + PKCE flow for accessing data belonging to users other than the app owner — a long-standing limitation of v1.

## License

[MIT](./LICENSE)
