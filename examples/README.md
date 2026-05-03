# Examples

Working demos of the [`splitwise`](../) SDK. Each example is a self-contained
mini-project that consumes the SDK via a `file:../..` dependency.

## Demos

### [`cli-client-credentials/`](./cli-client-credentials/)

Server-side / CLI app. Uses **Client Credentials** to access the app
owner's data — no user redirect required.

Prints a summary of the authenticated account (profile, groups, friends,
recent expenses). Has a `--verbose` mode that wires up the SDK's
request/response hooks for per-call logging.

Use when: you're building a personal automation, a backup tool, an internal
report — anything that operates on your own (or your org's) Splitwise
account without needing per-user OAuth.

### [`web-auth-code/`](./web-auth-code/)

Express web app. Uses **Authorization Code + PKCE** to log in any
Splitwise user and access their data.

Renders a login page → redirects to Splitwise → handles the callback →
shows a dashboard with the user's groups, friends, and recent expenses.
Persists the resulting OAuth token in an express-session cookie.

Use when: you're building a third-party app where users log in with their
own Splitwise account.

## Why two demos

The two OAuth flows have very different shapes:

- **Client Credentials** is one POST to the token endpoint and you're done.
  No browser involvement; no redirects; no state to track.
- **Authorization Code + PKCE** is a three-leg flow: generate URL →
  redirect user → handle callback → exchange code → use token. The SDK
  handles the cryptography and the URL generation; the surrounding plumbing
  (state persistence, callback routing) is the app's job.

Pick the demo that matches the kind of app you're building. The patterns
inside each are designed to copy-paste straight into your own codebase.

## Local development

These examples consume the SDK via `file:../..`. To pick up uncommitted
SDK changes:

```bash
# From the repo root:
npm run build
# Then in the example dir:
npm install   # if you haven't already
npm start
```

The `file:` dependency caches what was present at install time, so you may
need to delete `node_modules/splitwise` and reinstall after editing the SDK
source.
