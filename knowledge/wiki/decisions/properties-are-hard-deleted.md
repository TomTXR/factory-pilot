---
summary: Properties are deleted permanently after confirmation (Property)
---
# Properties are deleted permanently after confirmation

> Sources: Story #20, product owner answer 5 on https://github.com/TomTXR/factory-pilot/issues/20#issuecomment-6980020998
> Raw: [Story 20 properties](../../raw/stories/2026-11-18-story-20-manage-properties.md)
> Status: accepted
> Updated: 2026-11-19

## Context

Users must be able to remove a property.

## Decision

Delete is a hard delete after a confirmation dialog. There is no soft delete and no undo. Decided by the product owner in the issue.

## Reason

The proposed default was accepted. The story lists soft delete as out of scope.

## Alternatives

- Soft delete: out of scope in the story.

## Affects

- [Property](../product/property.md)
- [Screens](../design/screens.md)
