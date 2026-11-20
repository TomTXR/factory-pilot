---
summary: Google email and name are stored, an exception to synthetic data (Account)
---
# The Google email and display name are stored, an exception to synthetic data

> Sources: Story #28, product owner answer 5 on https://github.com/TomTXR/factory-pilot/issues/28#issuecomment-7005844848 ("thats fine, no problem")
> Raw: [Story 34 Google sign-in](../../raw/stories/2026-11-19-story-34-google-sign-in.md)
> Status: accepted
> Updated: 2026-11-19

## Context

`AGENTS.md` says data is always synthetic, but sign-in stores real Google data.

## Decision

The user id, email and display name from Google are stored. No profile photo and no other scopes. This is an accepted exception to the synthetic data rule.

## Reason

Needed to identify and show the account. The product owner accepted it.

## Alternatives

- Store only the Google user id: not chosen; the Account view shows name and email.

## Affects

- [Account](../product/account.md)
