# Story 35: Each account sees only its own properties (backfilled)

> Source: GitHub issue #35, TomTXR/factory-pilot, plan and product owner comments; backfilled from the issue by story #63
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

## Goal

Part 2 of #28. Every property has an owning account, so each signed-in account sees and changes only its own properties. Plan: https://github.com/TomTXR/factory-pilot/issues/35#issuecomment-7011825436. The plan states that the questions answered on #28 apply and are not asked again.

## Plan criteria that still hold in the code

1. A lists only A's properties; B only B's.
2. B gets, updates or deletes A's property id: 404 with the same body as an unknown id (not 403, so existence is not revealed).
3. The owner is the signed-in user. An owner or account field in a request body is ignored. API responses do not expose the owning account id.
4. The duplicate check from story #20 applies per account: two accounts can save the same address and owner name, one account cannot save it twice (409).

## Plan criterion that was dropped

Criterion 5 of the first plan: the first account that signs in after the deploy takes ownership of all properties without an owner. The product owner dropped it in a `/changes` comment on 2026-11-19 (https://github.com/TomTXR/factory-pilot/issues/35#issuecomment-7013278032):

> Drop acceptance criterion 5 and the claim of unowned properties. Properties without an owner stay invisible to every account and are never claimed automatically. Remove the claim code and its tests, and change the wiki: unowned properties are not shown and are assigned by hand if they ever exist. Production has 0 properties (checked 2026-11-19), so nothing is lost.

The claim had been approved earlier on #28 (https://github.com/TomTXR/factory-pilot/issues/28#issuecomment-7005844848, answer 3, and the refined plan https://github.com/TomTXR/factory-pilot/issues/28#issuecomment-7005992740).

## Release

The product owner approved the change on 2026-11-19 (https://github.com/TomTXR/factory-pilot/issues/35#issuecomment-7017926326). Pull request #45 merged as 31b577f. Migration `004_property_accounts.sql` still says in a comment that unowned rows are claimed; the migration was already applied, so it was not edited.

## Decisions

- A property belongs to exactly one account (plan and code).
- The duplicate check is per account (plan, migration 004).
- Unowned properties are never claimed automatically (product owner, `/changes`).
- Out of scope: sharing between accounts (#32).
