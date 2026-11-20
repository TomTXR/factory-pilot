# The duplicate check applies per account

> Sources: Story #35 plan criterion 4, https://github.com/TomTXR/factory-pilot/issues/35#issuecomment-7011825436; `api/migrations/004_property_accounts.sql`
> Raw: [Story 35 per-account properties](../../raw/stories/2026-11-19-story-35-per-account-properties.md)
> Status: accepted
> Updated: 2026-11-19

## Context

[A property is identified by its normalised address plus owner name](./property-identity-address-and-owner.md) made addresses unique across the table. With accounts, two users may track the same address.

## Decision

The unique index `properties_account_identity_idx` includes `account_user_id`. Two accounts can save the same address and owner; one account cannot save it twice (409). The index must match `normaliseKey` in `api/src/properties.ts`.

## Reason

The plan states the rule; no further reason is recorded.

## Alternatives

- Global uniqueness: rejected in the plan.

## Affects

- [Property](../product/property.md)
- [Data model](../architecture/data-model.md)
