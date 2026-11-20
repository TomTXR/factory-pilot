---
summary: Accounts are matched on the Google user id, not the email (Account)
---
# Accounts are matched on the Google user id, not on the email

> Sources: Story #34 plan restating #28 (https://github.com/TomTXR/factory-pilot/issues/28#issuecomment-7005992740); `google_sub` in `api/migrations/003_users_sessions.sql`
> Raw: [Story 34 Google sign-in](../../raw/stories/2026-11-19-story-34-google-sign-in.md)
> Status: accepted
> Updated: 2026-11-19

## Context

A returning user must reach the same account. Email addresses can change.

## Decision

The `users` table has a unique `google_sub`. Sign-in inserts or updates by that value; email and display name are refreshed on each sign-in.

## Reason

The Google user id is stable. The plan states the rule; no other reason is recorded.

## Alternatives

- Match on email: rejected in the plan.

## Affects

- [Account](../product/account.md)
- [Data model](../architecture/data-model.md)
