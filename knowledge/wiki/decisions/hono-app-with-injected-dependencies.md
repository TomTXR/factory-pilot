# The API is a Hono app with injected dependencies

> Sources: `AGENTS.md` section Architecture; `api/src/app.ts`
> Raw: [Story 34 Google sign-in](../../raw/stories/2026-11-19-story-34-google-sign-in.md)
> Status: accepted
> Updated: 2026-11-19

## Context

Routes must be testable without a database.

## Decision

`createApp(deps)` receives the database check, the property repository, the version and the auth stores. Production wires them in `api/src/server.ts`; unit tests pass fakes. The choice of Hono is stated in `AGENTS.md`; no source gives the reason for choosing Hono over other frameworks (unknown).

## Reason

Stated reason: routes can be tested without a database (`AGENTS.md`). Reason for Hono: unknown.

## Alternatives

- Not documented in the sources.

## Affects

- [API](../architecture/api.md)
- [System overview](../architecture/system-overview.md)
