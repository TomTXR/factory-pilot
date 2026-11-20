# Story 59: Fill in street and city from the BAG based on postal code and house number

> Source: GitHub issue #59, TomTXR/factory-pilot, plans and product owner comments (part 1 of 3 of #57)
> Collected: 2026-11-20
> Published: 2026-11-20
> Synthetic: no

## Goal

When a home owner adds or edits a Dutch property, the app suggests matching Dutch addresses while they type (PDOK Locatieserver, keyless) and fills street, house number, addition, postal code and city from the picked one. Filled fields are marked "From BAG" and stay editable; nothing is stored until the user saves. Parts #60 (building data) and #61 (floors) reuse the lookup.

## Acceptance criteria

The approved plan (second plan on #59) has 17 criteria: country first (1, 2); address search with up to 8 suggestions, picking, latest-text-only, no-match message and manual entry (3 to 7); "From BAG" markers and nothing stored without saving (8, 9); failure handling with a 5 second timeout (10); refresh with "Look up in BAG" on edit, including a not-found message and an additions choice (11, 12); API behind sign-in with input validation, a stub in CI and local, logging of outcome and duration only (13, 14); existing flows unchanged (15); 390 px layout with 44 px targets (16); numeric keyboard for house number (17).

## Product owner comments

- Change request: country first, lookup for Dutch properties only; autocomplete through PDOK `/suggest` and `/lookup`; keep the postal code and house number lookup only if it still adds something.
- Answers to the open questions of the second plan: "Yes to both, sounds good, plan is approved, go ahead." That is: keep "Look up in BAG" on the edit form, and show "Find address" on edit as well as on add.
- Earlier answers on #57 (from the plan): markers only in the open form, CI and local use a stub while previews and production call PDOK, automatic lookup replaced by the search.

## Decisions

- Calls to PDOK go through our own API (agent, in the plan): [Address search through PDOK via the API](../../wiki/decisions/address-search-through-pdok-via-the-api.md).
- Values are suggestions, source not stored (#57): [BAG values are suggestions](../../wiki/decisions/bag-values-are-suggestions-marked-only-in-the-form.md).
- Stub in CI and local (#57): [Stub address service](../../wiki/decisions/stub-address-service-in-ci-and-local.md).
- Country first, search replaces the blur lookup (change request): [Country before address](../../wiki/decisions/country-before-address-and-search-replaces-blur-lookup.md).
- Code choices (agent): stub chosen only for `DEPLOY_PROJECT` `pilot-dev`; the suggestion label is PDOK's plain `weergavenaam`, not highlight HTML; an external failure answers 200 `unavailable`; the refresh fills street and city only, as the criteria say.

## Concepts added or changed

Added: Address search ([article](../../wiki/product/address-search.md)). Changed: Property (country first, search fills the address), API, system overview, screens, UI patterns.

## Not automated

- Not automated: AC15 the existing add, edit and delete flows are covered by the existing e2e tests in `e2e/tests/properties.spec.ts` and the App tests, which are unchanged (only the field order moved) and still run in CI; a second test would repeat them.

## Review notes

Docker was not available in the build environment, so the Playwright tests in `e2e/tests/properties.spec.ts` were written but not run there; lint, typecheck and the api and web unit tests were run.
