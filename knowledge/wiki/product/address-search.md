---
summary: Address search concept: Dutch properties only, Find address combobox (PDOK suggest and lookup through our API), Look up in BAG refresh on edit, From BAG markers only in the open form, nothing saved without the user, stub in CI and local
concepts:
  - name: Address search
    code: api/src/addressClient.ts, api/src/pdokClient.ts, api/src/addressStub.ts, api/src/app.ts, web/src/components/AddressSearch.tsx, web/src/components/PropertyForm.tsx
    relates: fills Property
---
# Address search

> Sources: Story #59, 2026-11-20, plans and product owner answers on https://github.com/TomTXR/factory-pilot/issues/59 and #57
> Raw: [Story 59 address search](../../raw/stories/2026-11-20-story-59-address-search.md)
> Updated: 2026-11-20

## Purpose

Helps a home owner fill in the address of a Dutch property from the BAG (the Dutch address register) instead of typing it. It is a help, never required, and never stores anything by itself. Parts #60 (building data) and #61 (floors) extend the same lookup.

## Rules

1. Country is the first address field of the form. The search and the "Look up in BAG" button exist only for country Netherlands. Switching to Germany hides them, sends no request and clears no field.
2. "Find address" (add and edit form): from 3 characters, after a pause of 300 ms, up to 8 full addresses are suggested (street and number or postal code and house number both work). Picking one (tap, click, arrow keys and Enter) fills street, house number, addition, postal code and city. Escape or leaving the field closes the list.
3. Only the suggestions for the latest text are shown. A field changed by hand while a picked address loads is not overwritten.
4. Filled fields show a "From BAG" marker; a hand edit removes it. Markers exist only in form state. Nothing is stored until the user saves, and the saved values are exactly the values shown. The source and the BAG id are not stored.
5. "Look up in BAG" (edit form, NL): looks up the current postal code, house number and addition, replaces and marks street and city only. When several addresses match and the addition matches none, the available additions are offered as buttons; choosing one fills the addition and looks up again. Opening the form never looks up by itself. A result is discarded when postal code, house number or addition changed since.
6. Failure (service down, error, no answer within 5 seconds): a short message, no field changes, manual entry and saving stay possible. No retries.
7. The postal code is filled as "1234 AB", the notation the duplicate check ([property](property.md) rule 1) keeps apart from "1234AB".
8. Addition mapping: BAG house letter only "A", addition only "2", both "A-2". Additions are compared ignoring case, spaces and dashes.
9. CI and local stacks (`DEPLOY_PROJECT` `pilot-dev`) answer from a stub with synthetic addresses (postal codes with the letter pairs SA, SD, SS, never issued); previews and production call PDOK. Stub: postal code 9990 SD answers "unavailable", 9991 SD answers after a short delay.
10. The browser talks only to our API ([API](../architecture/api.md)); only the outcome and the duration of a call are logged.

## Relations

- Property: the search fills the address fields of the property form ([property](property.md)).

## Code

- `api/src/addressClient.ts`: client interface, input normalisation, addition mapping, `chooseAddress`.
- `api/src/pdokClient.ts`, `api/src/addressStub.ts`: the two implementations.
- `api/src/app.ts`: the `/api/address` routes. `api/src/server.ts`: stub or PDOK.
- `web/src/components/AddressSearch.tsx`, `PropertyForm.tsx`, `web/src/api.ts`: the form behaviour.

## Decisions

- [Address search through PDOK via the API](../decisions/address-search-through-pdok-via-the-api.md)
- [BAG values are suggestions, marked only in the form](../decisions/bag-values-are-suggestions-marked-only-in-the-form.md)
- [Stub address service in CI and local](../decisions/stub-address-service-in-ci-and-local.md)
- [Country before address, search replaces blur lookup](../decisions/country-before-address-and-search-replaces-blur-lookup.md)

## Stories

- #59: search, refresh, markers, stub.

## See Also

- [Property](property.md)
- [API](../architecture/api.md)
- [Screens](../design/screens.md)
- [UI patterns](../design/ui-patterns.md)
- [Concept map](../index.md)
