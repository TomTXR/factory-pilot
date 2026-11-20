---
summary: Google is the only sign-in, open sign-up, scopes openid email profile (Account)
---
# Google is the only sign-in method and any Google account can sign up

> Sources: Story #28, product owner answer 1 on https://github.com/TomTXR/factory-pilot/issues/28#issuecomment-7005844848; scopes in `api/src/googleClient.ts`
> Raw: [Story 34 Google sign-in](../../raw/stories/2026-11-19-story-34-google-sign-in.md)
> Status: accepted
> Updated: 2026-11-19

## Context

The app moved from no login to a login. The first plan asked who may sign in.

## Decision

The only method is Sign in with Google. Any Google account can sign in and the first sign-in creates the account; there is no allowlist. Only the scopes `openid`, `email` and `profile` are requested. Decided by the product owner ("yes any google account"). This replaces the earlier "no login" decision, which came from the SYNTHETIC persona interview.

## Reason

Keeps sign-up free of an approval step. Minimal scopes limit what is stored.

## Alternatives

- Allowlist of email addresses: not chosen by the product owner.
- Other sign-in methods: out of scope in #34.

## Affects

- [Sign-in with Google, sessions and API protection](../architecture/authentication.md)
- [Account](../product/account.md)
