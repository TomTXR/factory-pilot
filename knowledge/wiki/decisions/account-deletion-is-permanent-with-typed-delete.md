# Account deletion is permanent, confirmed by typing DELETE, in one transaction

> Sources: Story #46, product owner answers on https://github.com/TomTXR/factory-pilot/issues/46#issuecomment-7012494065; `api/src/authStores.ts`, `api/src/authRoutes.ts`
> Raw: [Story 46 delete account](../../raw/stories/2026-11-19-story-46-delete-account.md)
> Status: accepted
> Updated: 2026-11-19

## Context

Users must be able to remove their own data. The plan asked about permanence and the confirmation.

## Decision

Deleting the account permanently removes the account, all its sessions (on every device) and all its properties in one transaction. There is no grace period, undo or export. The user types `DELETE` (exact, case-sensitive, surrounding spaces ignored in the UI; the API requires `confirm: "DELETE"`). The dialog names the number of properties and says it cannot be undone. The API logs the user id and the number of deleted properties, not email or name. A later sign-in with the same Google account creates a new empty account.

## Reason

The product owner confirmed all defaults, asked that the warning says the properties are permanently deleted, and called typing DELETE best practice.

## Alternatives

- Grace period, soft delete, export: not chosen; the plan's default was permanent deletion.

## Affects

- [Account deletion](../product/account-deletion.md)
- [Account](../product/account.md)
