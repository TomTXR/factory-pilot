# 001: A property is identified by its normalised address plus owner name

> Sources: Story #20, product owner answers 2 and 3 on https://github.com/TomTXR/factory-pilot/issues/20#issuecomment-6980020998 (proposed defaults accepted); unique index in `api/migrations/004_property_accounts.sql`
> Raw: [Story 20 properties](../../raw/stories/2026-11-18-story-20-manage-properties.md)
> Status: accepted
> Updated: 2026-11-19

## Context

The app needs a rule for when two properties are the same, so duplicates are rejected.

## Decision

Identity is street, house number, house number addition, postal code, city, country and owner name, compared lower-cased with whitespace collapsed. The addition is part of the identity. A duplicate is rejected with 409. Decided by the product owner in the issue; the normalisation is implemented in `normaliseKey` (`api/src/properties.ts`) and the unique index. Since #35 the check is per account ([012](./012-duplicate-check-per-account.md)).

## Reason

The plan of #20 proposed this and the product owner accepted all proposed defaults. The owner name is part of the key so the same address can be tracked for another owner (the persona may be a person or an entity).

## Alternatives

- Address only: not chosen; the story asks for address plus owner.

## Affects

- [Property](../product/property.md)
- [Data model](../architecture/data-model.md)
