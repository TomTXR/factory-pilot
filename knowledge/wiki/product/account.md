---
summary: Account concept: created on first Google sign-in, matched on Google user id, stored fields, email and name stored as exception to synthetic data
concepts:
  - name: Account
    code: api/src/auth.ts, api/src/authStores.ts, api/migrations/003_users_sessions.sql, web/src/components/AccountView.tsx
    relates: owns Property
---
# Account

> Sources: Story #34, 2026-11-19; product owner answers on #28, 2026-11-19; Story #63, 2026-11-19
> Raw: [Story 34 Google sign-in](../../raw/stories/2026-11-19-story-34-google-sign-in.md); [Story 63](../../raw/stories/2026-11-19-story-63-document-current-app.md)
> Updated: 2026-11-19

## Purpose

An account is a person who signs in to the app. It owns properties and has sessions. It is created automatically on the first Google sign-in.

## Rules

1. Any Google account can sign in; the first sign-in creates the account. There is no allowlist and no approval.
2. An account is matched on the Google user id (`users.google_sub`), never on the email.
3. The stored fields are the Google user id, email and display name, plus created and last login times. Email and name are refreshed on every sign-in. If Google sends no name, the email is used as the name.
4. Storing the real email and name is an accepted exception to "data is always synthetic" (product owner, #28). Test sign-in accounts use fixed synthetic identities.
5. The signed-in user sees their name and email in the Account view (name in the header opens it).
6. An account can be deleted by its user ([account deletion](account-deletion.md)). A later sign-in with the same Google account creates a new, empty account.

## Relations

- Property: an account owns zero or more properties ([property](property.md)).
- Session: an account has many sessions ([authentication](../architecture/authentication.md)).
- Account deletion: removes the account, its sessions and properties ([account deletion](account-deletion.md)).

## Code

- `api/src/auth.ts`, `api/src/authStores.ts`: `User`, `signIn` (insert or update by Google user id).
- `api/src/authRoutes.ts`: `GET /api/auth/me`.
- `api/migrations/003_users_sessions.sql`: `users` table.
- `web/src/components/AccountView.tsx`: Account view.

## Decisions

- [006 Google only, open sign-up](../decisions/google-only-sign-in-with-open-sign-up.md)
- [007 Matched on the Google user id](../decisions/accounts-matched-on-google-user-id.md)
- [010 Email and name are stored](../decisions/store-google-email-and-name.md)

## Stories

- #34: accounts and Google sign-in.
- #35: accounts own properties.
- #46: account deletion.

## See Also

- [Home owner persona](../users/home-owner.md)
- [Property](property.md)
- [Account deletion](account-deletion.md)
- [Authentication](../architecture/authentication.md)
- [Home Maintenance Log](home-maintenance-log.md)
- [Concept map](../index.md)
