---
summary: Property concept: country asked first, address can be filled by the address search, identity is address plus owner, required and optional fields, validation limits, one account per property, 404 for other accounts, hard delete, selection per browser, unowned properties never claimed
concepts:
  - name: Property
    code: api/src/properties.ts, api/src/propertyRepository.ts, api/migrations/002_properties.sql, api/migrations/004_property_accounts.sql, web/src/components/PropertyForm.tsx
  - name: Property sharing
    status: planned
    relates: extends Property; involves Account
---
# Property

> Sources: Story #20, 2026-11-18; Story #35, 2026-11-19; Story #63, 2026-11-19; Story #59, 2026-11-20
> Raw: [Story 20 properties](../../raw/stories/2026-11-18-story-20-manage-properties.md); [Story 35 per-account properties](../../raw/stories/2026-11-19-story-35-per-account-properties.md); [Story 63](../../raw/stories/2026-11-19-story-63-document-current-app.md); [Story 59](../../raw/stories/2026-11-20-story-59-address-search.md)
> Updated: 2026-11-20

## Purpose

A property is a house or apartment of a home owner, the thing whose maintenance the app will track. Today it is the only domain record in the app. Items and maintenance entries (planned) will hang off it.

## Rules

1. A property is identified by street, house number, addition, postal code, city, country and owner name, compared lower-cased with whitespace collapsed. A duplicate within one account is rejected with 409. The rule lives in `normaliseKey` (`api/src/properties.ts`) and the unique index `properties_account_identity_idx`; the two must match.
2. Required: street, house number, postal code, city, owner name. Optional: display name, addition, country, characteristics. Text fields hold at most 200 characters, notes at most 2000.
3. Country is NL (default) or DE. The form asks for it before the address fields; for NL the address can be filled with the [address search](address-search.md), which writes the postal code as "1234 AB".
4. Optional characteristics: type (house, apartment, other), year built (whole number from 1500 up to the current year), living area in m2 (above 0, at most 100000, rounded to 2 decimals), rooms (whole number 1 to 1000), notes.
5. Create and update use the same validation (`validateProperty`). A failed validation answers 400 with one message per field.
6. A property belongs to exactly one account, the one that created it. The owner is taken from the session; an owner field in a request body is ignored; the owning account id is never in a response.
7. An account sees, updates and deletes only its own properties. Another account's id answers 404, the same as an unknown id or an id that is not a UUID.
8. Properties are deleted permanently after a confirmation. Nothing else (items, entries) exists yet; the story that adds them must define what happens to them on delete.
9. The switcher shows the display name, or street and house number with the addition when there is no display name.
10. The selected property is kept per browser in `localStorage` (`selectedPropertyId`) and removed on sign-out, on a 401 and after account deletion. If the stored id is not in the list, the first property is selected.
11. Properties without an account are shown to no account and never claimed automatically. If they exist they are assigned by hand. Conflict: the comment in `api/migrations/004_property_accounts.sql` says unowned rows are claimed by the first account that signs in; the code does not do this ([Properties without an owner are never claimed automatically](../decisions/unowned-properties-never-claimed-automatically.md), [The first account that signs in claims properties without an owner](../decisions/first-account-claims-unowned-properties.md)).

## Relations

- Address search: fills the address fields of the form for Dutch properties ([address search](address-search.md)).
- Account: owns the property; deleting the account deletes its properties ([account](account.md), [account deletion](account-deletion.md)).
- Item (planned): will belong to a property ([overview](home-maintenance-log.md)).
- Property sharing (planned, #32): not built; today a property has exactly one account.

## Code

- `api/src/properties.ts`: types, validation, `normaliseKey`, repository interface.
- `api/src/propertyRepository.ts`: SQL (always filtered on the account).
- `api/src/app.ts`: the `/api/properties` routes ([API](../architecture/api.md)).
- `api/migrations/002_properties.sql`, `004_property_accounts.sql`: table, constraints, indexes ([data model](../architecture/data-model.md)).
- `web/src/App.tsx`, `web/src/components/PropertyForm.tsx`, `PropertyDetails.tsx`, `PropertySwitcher.tsx`, `EmptyState.tsx`, `ConfirmDeleteDialog.tsx`: the screens ([screens](../design/screens.md)).

## Decisions

- [001 Identity is address plus owner](../decisions/property-identity-address-and-owner.md)
- [002 Hard delete](../decisions/properties-are-hard-deleted.md)
- [003 Editing included](../decisions/property-editing-is-included.md)
- [004 Selection remembered per browser](../decisions/selected-property-remembered-per-browser.md)
- [005 Countries NL and DE](../decisions/countries-nl-and-de.md)
- [011 One account per property, 404 for others](../decisions/property-belongs-to-one-account-others-get-404.md)
- [012 Duplicate check per account](../decisions/duplicate-check-per-account.md)
- [013 Claim of unowned properties (superseded)](../decisions/first-account-claims-unowned-properties.md)
- [014 Unowned properties never claimed](../decisions/unowned-properties-never-claimed-automatically.md)

## Stories

- #20: add, switch, view, edit, delete properties.
- #35: properties belong to an account.
- #59: country first, address search.

## See Also

- [Address search](address-search.md)
- [Home Maintenance Log](home-maintenance-log.md)
- [Account](account.md)
- [Data model](../architecture/data-model.md)
- [API](../architecture/api.md)
- [Screens](../design/screens.md)
- [Account deletion](account-deletion.md)
- [Concept map](../index.md)
