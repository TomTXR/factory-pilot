# Properties without an owner are never claimed automatically

> Sources: Story #35, product owner `/changes` comment on https://github.com/TomTXR/factory-pilot/issues/35#issuecomment-7013278032; code in `api/src/propertyRepository.ts` (no claim code)
> Raw: [Story 35 per-account properties](../../raw/stories/2026-11-19-story-35-per-account-properties.md)
> Status: accepted
> Updated: 2026-11-19

## Context

Supersedes [The first account that signs in claims properties without an owner](./first-account-claims-unowned-properties.md). The product owner reviewed the preview of #35 and changed the plan.

## Decision

"Properties without an owner stay invisible to every account and are never claimed automatically." If such rows exist they are assigned by hand. The claim code and its tests were removed. Production had 0 properties on 2026-11-19. Conflict annotation: the comment in migration 004 still describes the claim (see 013); the code and this record are the current rule.

## Reason

Nothing is lost because production had no properties (the product owner's own words). No other reason is written down.

## Alternatives

- Claim by the first account: superseded 013.

## Affects

- [Property](../product/property.md)
- [Data model](../architecture/data-model.md)
