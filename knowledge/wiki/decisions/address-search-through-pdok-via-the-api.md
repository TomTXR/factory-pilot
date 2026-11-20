---
summary: Keyless PDOK Locatieserver suggest, lookup and free behind our own API routes, not called from the browser, not the keyed Kadaster API
---
# Address search goes through PDOK via our own API

> Sources: Story #59 comments by TomTXR and the story plan, 2026-11-20
> Raw: [Story 59 address search](../../raw/stories/2026-11-20-story-59-address-search.md)
> Status: accepted
> Updated: 2026-11-20

## Context

The product owner asked for autocomplete using the keyless PDOK Locatieserver.

## Decision

The API exposes protected routes `/api/address/suggest` and `/api/address/lookup` and calls PDOK server-side with a 5 second timeout (agent, in the plan; approved by the product owner).

## Reason

CI can use a stub without CORS or CSP changes, input is validated before any external call, labels are built from plain fields, and logging can be kept free of address data.

## Alternatives

- Browser calls PDOK directly: needs CSP changes and cannot be stubbed in CI.
- Keyed Kadaster API: needs a secret and a human task, not needed for this part.

## Affects

- [Address search](../product/address-search.md)
