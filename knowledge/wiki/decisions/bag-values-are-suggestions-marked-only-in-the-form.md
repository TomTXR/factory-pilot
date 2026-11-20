---
summary: BAG values fill the open form as marked suggestions; nothing is stored until the user saves, and the source is not stored
---
# BAG values are suggestions, marked only in the form

> Sources: Story #59 comments by TomTXR and the story plan, 2026-11-20
> Raw: [Story 59 address search](../../raw/stories/2026-11-20-story-59-address-search.md)
> Status: accepted
> Updated: 2026-11-20

## Context

Answer 2 on #57: users must stay in control of their address data.

## Decision

Values from the BAG are filled into the form with a From BAG marker. Markers exist only in form state; saving stores the shown values and not their source or a BAG id (product owner, #57).

## Reason

A saved address stays valid when it is edited by hand, and the property identity (address plus owner) stays unchanged.

## Alternatives

- Store the BAG id and source: out of scope, a later part can add it.
- Validate on save that the address exists in the BAG: manual addresses must stay valid.

## Affects

- [Address search](../product/address-search.md)
