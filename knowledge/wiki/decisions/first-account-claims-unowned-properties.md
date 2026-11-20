# The first account that signs in claims properties without an owner

> Sources: Story #28 plan question 3 and answer 3 on https://github.com/TomTXR/factory-pilot/issues/28#issuecomment-7005844848 ("there are no properties in production but if there are your suggestion makes sense"); refined plan https://github.com/TomTXR/factory-pilot/issues/28#issuecomment-7005992740
> Raw: [Story 35 per-account properties](../../raw/stories/2026-11-19-story-35-per-account-properties.md)
> Status: superseded by [Properties without an owner are never claimed automatically](./unowned-properties-never-claimed-automatically.md)
> Updated: 2026-11-19

## Context

Properties created before accounts exist have no owner. The plan proposed what happens to them.

## Decision

The first account that signs in after #35 is deployed takes ownership of all unowned properties; nothing is deleted. Approved by the product owner on #28. The product owner dropped it on #35, see [Properties without an owner are never claimed automatically](./unowned-properties-never-claimed-automatically.md). Conflict annotation: the comment in `api/migrations/004_property_accounts.sql` still says unowned rows are claimed by the first account that signs in; the code does not do this. The migration was applied and is not edited.

## Reason

Production had no properties, so the claim protected no data (answer 3).

## Alternatives

- Leave them unowned: chosen later in 014.

## Affects

- [Property](../product/property.md)
- [Data model](../architecture/data-model.md)
