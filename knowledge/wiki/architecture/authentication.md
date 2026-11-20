# Authentication: Google sign-in, sessions and API access protection

> Sources: `api/src/auth.ts`, `authRoutes.ts`, `authStores.ts`, `googleClient.ts`, `server.ts`, checked 2026-11-19; Story #34; product owner answers on #28; Story #63
> Raw: [Story 34 Google sign-in](../../raw/stories/2026-11-19-story-34-google-sign-in.md); [Story 63](../../raw/stories/2026-11-19-story-63-document-current-app.md)
> Updated: 2026-11-19

## Purpose

This article holds three concepts: Sign-in with Google (including the labelled test sign-in), Session, and API access protection. Together they make sure only a signed-in account reaches its data.

## Rules

Sign-in with Google

1. Flow: `GET /api/auth/login` creates a random `state`, PKCE `verifier` and `nonce`, keeps them in memory (single use, 10 minutes), sets the cookie `pilot_login` (httpOnly, secure, SameSite Lax, path `/api/auth`) and redirects to Google with `response_type=code`, scope `openid email profile`, `code_challenge` (S256), `state` and `nonce`. The redirect URI is `PUBLIC_BASE_URL/api/auth/callback`.
2. `GET /api/auth/callback` checks that the `state` query equals the `pilot_login` cookie and a pending entry exists and has not expired. It removes the entry whatever the outcome. It then exchanges the code (with the PKCE verifier and client secret), fetches Google's keys and verifies the ID token: RS256 signature, issuer, audience equals the client id, expiry, nonce, a subject and an email. It signs the user in and starts a session. Any failure, or a Google `error`, redirects to `/?auth_error=1` and creates no account; the login screen then shows "Sign-in did not complete. Please try again."
3. Pending logins are kept in memory of one API process. A restart drops them and a started sign-in then fails the state check. The sources do not discuss running several API instances.
4. Test sign-in: when there are no Google settings and `DEPLOY_PROJECT` matches `pilot-dev` or `pilot-pr-<digits>`, the mode is `test`. `POST /api/auth/test-login` signs in a fixed synthetic user and the login screen shows a labelled "Test sign-in" button. Body `{"user": "a"}` to `"e"` picks one; default `a`. Users in `TEST_USERS`: `a`, `b` general (two accounts in e2e), `c` only the empty-state e2e test, `d` and `e` the account deletion e2e tests (desktop and mobile). Their emails use `example.com`.
5. Fail closed: with Google settings the mode is `google` (and `PUBLIC_BASE_URL` is then required). Without them and outside those project names, `loadAuthConfig` throws and the API exits with an error log. Production therefore never offers the test sign-in ([Labelled test sign-in on non-production stacks, fail closed in production](../decisions/labelled-test-sign-in-fail-closed-in-production.md)).

Session

6. After sign-in the API creates a random token (32 bytes, base64url), stores only its SHA-256 hash in `sessions` and sets the cookie `pilot_session`: httpOnly, secure, SameSite Lax, path `/`, max age 30 days.
7. A session lasts 30 days from last use (`SESSION_TTL_MS`). When an unexpired session is used and its last use is at least 5 minutes old (`SESSION_REFRESH_MS`), the API moves `last_used_at` and `expires_at` forward and re-sets the cookie. So the database is written at most every 5 minutes per session.
8. Expired sessions are never found. They are deleted only when the API starts (`purgeExpired`).
9. `POST /api/auth/logout` deletes the session row and the cookie and answers 204. Sign-out takes effect on the server at once.

API access protection

10. `requireUser` reads the cookie, looks up the hash and answers 401 `{"error":"Not signed in"}` if there is no valid session. It is applied to `/api/properties`, `/api/properties/*`, `/api/auth/me` and `/api/auth/account`. `/api/health`, `/api/version` and the other `/api/auth` routes are public.
11. The web app shows the login screen until `GET /api/auth/me` returns a user. A 401 from any call returns the app to the login screen and clears the stored property selection. A page restored from the back/forward cache is reloaded so the session is re-checked.

## Relations

- Account: created by the first sign-in ([account](../product/account.md)).
- Property routes depend on `requireUser` ([API](api.md), [property](../product/property.md)).
- Account deletion uses the same protection ([account deletion](../product/account-deletion.md)).

## Code

- `api/src/auth.ts`: types, TTL constants, test users, `loadAuthConfig`, token hashing, PKCE.
- `api/src/authRoutes.ts`: routes, cookies, `requireUser`.
- `api/src/authStores.ts`: user and session SQL.
- `api/src/googleClient.ts`: authorization URL, code exchange, ID token check.
- `api/src/server.ts`: config at start-up, purge of expired sessions.
- `web/src/AuthGate.tsx`, `web/src/components/LoginScreen.tsx`, `web/src/api.ts`.
- `api/migrations/003_users_sessions.sql`.
- `e2e/tests/auth.spec.ts`, `accounts.spec.ts`.

## Decisions

- [006 Google only, open sign-up](../decisions/google-only-sign-in-with-open-sign-up.md)
- [007 Matched on the Google user id](../decisions/accounts-matched-on-google-user-id.md)
- [008 Server-side sessions, 30 days, hashed tokens](../decisions/server-side-sessions-30-days-hashed-tokens.md)
- [009 Labelled test sign-in, fail closed](../decisions/labelled-test-sign-in-fail-closed-in-production.md)
- [010 Email and name stored](../decisions/store-google-email-and-name.md)

## Stories

- #34: Google sign-in, sessions, API protection.

## See Also

- [API](api.md)
- [System overview](system-overview.md)
- [Screens](../design/screens.md)
- [Account](../product/account.md)
- [Account deletion](../product/account-deletion.md)
- [Data model](data-model.md)
- [Home Maintenance Log](../product/home-maintenance-log.md)
- [Concept map](../index.md)
