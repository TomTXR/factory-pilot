---
summary: A property belongs to one account, other accounts get 404 (Property, API access protection)
---
# A property belongs to exactly one account, other accounts get 404

> Sources: Story #35 plan https://github.com/TomTXR/factory-pilot/issues/35#issuecomment-7011825436; `api/src/propertyRepository.ts`
> Raw: [Story 35 per-account properties](../../raw/stories/2026-11-19-story-35-per-account-properties.md)
> Status: accepted
> Updated: 2026-11-19

## Context

After sign-in all accounts still shared one list. Per-account data was split into #35.

## Decision

Each property has one owning account, set from the session and never from the request body. All queries filter on the account. Another account's property id answers 404 with the same body as an unknown id, so its existence is not revealed. The owning account id is not part of any API response. Sharing is a later story (#32).

## Reason

Privacy between accounts. 404 instead of 403 hides existence (plan criterion 2).

## Alternatives

- 403 for foreign ids: rejected in the plan.

## Affects

- [Property](../product/property.md)
- [API](../architecture/api.md)
