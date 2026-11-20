# 009: Labelled test sign-in on non-production stacks, fail closed in production

> Sources: Story #28 plan question 4 (previews cannot use Google) and answer "understood" on https://github.com/TomTXR/factory-pilot/issues/28#issuecomment-7005844848; `loadAuthConfig` in `api/src/auth.ts`; `AGENTS.md` rule 11
> Raw: [Story 34 Google sign-in](../../raw/stories/2026-11-19-story-34-google-sign-in.md)
> Status: accepted
> Updated: 2026-11-19

## Context

Previews (`pilot-pr-<n>`), CI and local runs cannot use real Google sign-in and never get Google secrets.

## Decision

Without Google settings the API runs a test sign-in mode only when `DEPLOY_PROJECT` is `pilot-dev` or `pilot-pr-<n>`. The login screen labels it as a test environment and signs in as a fixed synthetic user. Any other project (production, unknown) without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` makes the API refuse to start. Real Google sign-in is checked on production after merge. The fail-closed rule is a technical choice in the code, following `AGENTS.md` rule 11 (never run unprotected).

## Reason

The app must work without secrets where possible and otherwise fail loudly.

## Alternatives

- An explicit enable flag: proposed in the first plan; the code instead derives the mode from the project name. The reason for the change is not written down.

## Affects

- [Sign-in with Google, sessions and API protection](../architecture/authentication.md)
- [System overview](../architecture/system-overview.md)
