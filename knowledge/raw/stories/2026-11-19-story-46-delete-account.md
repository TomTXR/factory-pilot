# Story 46: Let a signed-in user delete their own account (backfilled)

> Source: GitHub issue #46, TomTXR/factory-pilot, plans and product owner answers; backfilled from the issue by story #63
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

## Goal

A signed-in user can permanently delete their own account from an "Account" view with a separated "Danger zone". A typed confirmation is required. The deletion removes the account, its sessions and its properties and returns to the login screen. First plan: https://github.com/TomTXR/factory-pilot/issues/46#issuecomment-7012371725. Refined plan: https://github.com/TomTXR/factory-pilot/issues/46#issuecomment-7012603969.

## Product owner answers

Answers on 2026-11-19 (https://github.com/TomTXR/factory-pilot/issues/46#issuecomment-7012494065). The question texts are in the first plan, which is not copied here; the answers read:

1. Yes (all proposed defaults confirmed).
2. Correct, the properties are permanently deleted. "This needs to be said in the warning when deleting the account to the user."
3. Yes, typing DELETE "is best practice, let's do that".
4. Yes, create the Account view.
5. Yes.

The product owner approved the plan (https://github.com/TomTXR/factory-pilot/issues/46#issuecomment-7013663992) and the release (https://github.com/TomTXR/factory-pilot/issues/46#issuecomment-7022658448). Pull request #55 merged as d926fa8.

## Decisions

- Deletion is permanent, with no grace period, undo or export, in one transaction (plan, code in `api/src/authStores.ts`).
- The dialog must name the number of properties that are deleted (answer 2).
- The user types `DELETE` to confirm (answer 3).
- The properties foreign key stays without cascade; the deletion removes properties explicitly (code comment in `api/src/authStores.ts`).
