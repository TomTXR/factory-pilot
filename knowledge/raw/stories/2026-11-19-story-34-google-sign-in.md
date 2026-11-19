# Story 34: Sign in with Google and protect the API

> Source: GitHub issue #34, TomTXR/factory-pilot, approved plan (part 1 of 2 of #28); product owner answers recorded on #28 on 2026-11-19
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

## Goal

The Home Maintenance Log is behind Google sign-in. A visitor without a valid session sees only a login screen, and every `/api/properties` route answers 401 without a session. All signed-in accounts still share the same properties until story #35 (per-account data).

## Product owner decisions (from #28, as restated in the approved plan of #34)

- Any Google account can sign in; there is no allowlist or approval.
- The first Google sign-in creates an account automatically (Google user id, email, display name). Accounts are matched on the Google user id, not the email.
- A session lasts 30 days from last use.
- Previews, CI and local runs never receive Google secrets. They show a clearly labelled "Test sign-in" as a synthetic test user instead of Google. Production never offers it.
- The Google email and name of real users are stored. This is an accepted exception to "Data is always synthetic".
- Only the scopes `openid`, `email` and `profile` are used.

## Out of scope

Other sign-in methods, per-account data (#35), sharing (#32), account settings or deletion, profile photos.
