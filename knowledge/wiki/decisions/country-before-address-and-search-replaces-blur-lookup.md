---
summary: Country is the first address field and controls whether the search is offered; address search replaces the lookup on leaving a field; postal code lookup stays only as the edit refresh
---
# Country before address, search replaces the blur lookup

> Sources: Story #59 comments by TomTXR and the story plan, 2026-11-20
> Raw: [Story 59 address search](../../raw/stories/2026-11-20-story-59-address-search.md)
> Status: accepted
> Updated: 2026-11-20

## Context

TomTXR asked on #59 for the country first, and for autocomplete instead of the first plan's lookup after leaving postal code or house number.

## Decision

The form asks for the country before the address; the search is offered for NL only. The lookup on leaving a field is dropped. The postal code lookup stays behind the edit button, and the search is also shown on edit (product owner approval of the open questions, #59).

## Reason

The search accepts a postal code and house number, so the blur lookup added little. Existing properties store no BAG id, so the refresh needs the postal code lookup; #60 and #61 reuse it.

## Alternatives

- Keep both lookups: two ways to do the same on add.
- Drop the refresh: existing properties could not be refreshed.

## Affects

- [Address search](../product/address-search.md)
- [Property](../product/property.md)
- [Countries are Netherlands and Germany](countries-nl-and-de.md)
