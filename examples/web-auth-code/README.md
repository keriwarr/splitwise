# web-auth-code

A small Express app that logs you in via Splitwise's **Authorization Code +
PKCE** OAuth flow and shows your account on a dashboard. Use this as a
template for any web app that needs to access another user's Splitwise
data (not just the app owner's).

## Setup

1. Register an app at <https://secure.splitwise.com/apps>. Set the **Callback
   URL** to:

   ```
   http://localhost:3000/auth/callback
   ```

2. Copy the **Consumer Key** and **Consumer Secret** from the app page.

3. Install dependencies and run:

   ```bash
   cd examples/web-auth-code
   npm install
   SPLITWISE_CONSUMER_KEY=...    \
   SPLITWISE_CONSUMER_SECRET=... \
   SESSION_SECRET=any-random-string \
     npm start
   ```

4. Open <http://localhost:3000> in your browser. Click "Log in with
   Splitwise"; you'll bounce out, approve, and bounce back to the dashboard.

## What this demonstrates

- **Authorization Code + PKCE** — the SDK generates the redirect URL,
  `state` (CSRF token), and `codeVerifier` for you. The app's only job is to
  persist `state` and `codeVerifier` somewhere durable until the callback
  fires (this demo uses an express-session cookie).
- **`Splitwise.fromAuthorizationCode()`** — the SDK exchanges the callback
  `code` (plus your `codeVerifier`) for an access token in one call. Returns
  a fully-configured `Splitwise` client.
- **`sw.getOAuthToken()`** — pulls the full `OAuthToken` (with `expiresAt`
  and `refreshToken` if Splitwise provided them). Persist this on the
  session and rebuild the client from `accessToken` on subsequent requests.
- **State validation** — the demo checks `state` matches before exchanging
  the code (CSRF protection).
- **Typed error handling** — `SplitwiseAuthenticationError` triggers a
  graceful redirect to the login page; everything else falls through to the
  generic 500 handler.

## Why we need a backend (no pure-SPA version)

Splitwise's OAuth issuer requires `client_secret` on the token exchange,
even with PKCE. That means the secret can't live in browser-deliverable JS
— you need a server to do the exchange and hold the resulting token. This
demo's backend is intentionally tiny (one file, ~300 lines including
inline HTML) so you can copy the relevant bits into your own server-side
framework of choice.

## Production checklist

This is a demo; **do not** ship it as-is. For production you'll want:

- HTTPS (set `cookie.secure: true` on the session middleware once you have
  it).
- A real session store (the default in-memory store loses sessions on
  restart and leaks RAM).
- CSRF protection on the `POST /logout` route (and any other state-changing
  routes you add).
- A cookie-signing secret loaded from a secret manager, not an env var.
- Rate limiting on `/login` and `/auth/callback`.
- Proper logging / observability — use the SDK's `hooks` constructor option
  to feed your APM tool.
