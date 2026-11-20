---
summary: The local and CI stack (DEPLOY_PROJECT pilot-dev) answer address calls from a synthetic stub; previews and production call PDOK
---
# Stub address service in CI and local

> Sources: Story #59 comments by TomTXR and the story plan, 2026-11-20
> Raw: [Story 59 address search](../../raw/stories/2026-11-20-story-59-address-search.md)
> Status: accepted
> Updated: 2026-11-20

## Context

Answer 3 on #57: no real addresses in the repository, and CI has no reliable network to PDOK.

## Decision

`api/src/server.ts` uses the stub when `DEPLOY_PROJECT` is `pilot-dev` and PDOK otherwise, and logs the mode. Stub postal codes use the letter pairs SA, SD and SS, which are never issued.

## Reason

Tests are repeatable and keep to the synthetic data rule in AGENTS.md. Previews call PDOK so a human can try real lookups.

## Alternatives

- PDOK in CI: flaky and uses real addresses.
- Stub everywhere: the feature would never be verified against the real service.

## Affects

- [Address search](../product/address-search.md)
