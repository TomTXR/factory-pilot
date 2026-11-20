# properties.account_user_id has no cascade on delete, sessions.user_id has one

> Sources: Comment in `api/migrations/004_property_accounts.sql`; `deleteAccount` in `api/src/authStores.ts`
> Raw: [Story 35 per-account properties](../../raw/stories/2026-11-19-story-35-per-account-properties.md)
> Status: accepted
> Updated: 2026-11-19

## Context

Deleting a user row must not silently delete property data. Sessions are only login state.

## Decision

The foreign key from properties to users has no `on delete cascade`, so deleting a user with properties fails. Account deletion removes the properties explicitly in the same transaction. The foreign key from sessions to users cascades. Decided by the agent in the code of #35; the reason is the migration comment ("deleting an account must not delete data").

## Reason

Safety: only the explicit account deletion flow ([Account deletion is permanent, confirmed by typing DELETE, in one transaction](./account-deletion-is-permanent-with-typed-delete.md)) removes properties.

## Alternatives

- Cascade on properties: rejected by the migration comment.

## Affects

- [Data model](../architecture/data-model.md)
- [Account deletion](../product/account-deletion.md)
