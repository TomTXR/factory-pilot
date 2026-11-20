---
summary: Login, empty state, switcher, details, add and edit form, delete dialogs, Account view, header and footer; behaviour at 390 px as far as the code shows it
---
# Screens

> Sources: `web/src` on `main`, checked 2026-11-19; Stories #18, #20, #34, #46, #59; Story #63
> Raw: [Story 20 properties](../../raw/stories/2026-11-18-story-20-manage-properties.md); [Story 34 Google sign-in](../../raw/stories/2026-11-19-story-34-google-sign-in.md); [Story 46 delete account](../../raw/stories/2026-11-19-story-46-delete-account.md); [Story 63](../../raw/stories/2026-11-19-story-63-document-current-app.md); [Story 59](../../raw/stories/2026-11-20-story-59-address-search.md)
> Updated: 2026-11-20

## Purpose

The screens the app has today and what each shows. Shared styles and patterns are in [UI patterns](ui-patterns.md).

## Rules

1. Every screen must work on a 390 px wide mobile screen and on desktop (`AGENTS.md` rule 8).
2. Loading: `AuthGate` shows "Loading..." (role status) until `GET /api/auth/me` answers. If the server cannot be reached it shows "The server could not be reached." with Retry. After sign-in the app shows "Loading properties..." and, if the list fails, "The properties could not be loaded." with Retry.
3. Login screen (`LoginScreen`): title "Home Maintenance Log", "Sign in to see your properties.". In Google mode one full-width link button "Sign in with Google". In test mode a full-width "Test sign-in" button and the text "Test environment only: signs in as a synthetic test user, not with Google." After a failed sign-in (`?auth_error`) or a failed test sign-in it shows the alert "Sign-in did not complete. Please try again." After account deletion it shows the status "Your account has been deleted."
4. Header (signed in): the title, the badge `API: <status>` (colours: grey loading, green ok, amber degraded, red unreachable), the user name as a button (opens the Account view, label "Account of <name>", name truncated at 10rem) and "Sign out". Sign-out ends the session, clears the stored selection and does a full page navigation to `/`.
5. Footer: "Version x.y.z" or "Version unknown", shown once the version request has finished ([app version](../product/app-version.md)).
6. Empty state (`EmptyState`): dashed card, "No properties yet", a short text and the button "Add your first property".
7. Property switcher (`PropertySwitcher`): a labelled select "Property" with one option per property and a button "Add property". Shown with the details when at least one property exists.
8. Property details (`PropertyDetails`): the property label as heading, buttons "Edit property" and "Delete property", then a definition list: Name (if any), Owner, Address (street, number and addition, postal code and city, country name) and the characteristics that are set (Type, Year built, Living area, Rooms, Notes).
9. Add and edit form (`PropertyForm`): titled "Add property" or "Edit property", submit "Add property" or "Save changes", and Cancel. Fields in order: display name, country, "Find address" (NL only), street, house number (numeric keyboard), addition, postal code, city, owner name; fields filled from the BAG show a "From BAG" marker in their label; on the edit form of a Dutch property a "Look up in BAG" button follows the city field, with its messages and addition buttons ([address search](../product/address-search.md)); a "Characteristics (optional)" group with property type, year built, living area (m2), number of rooms, notes. Required fields are marked "(required)". Errors are inline per field and in an alert at the top (a duplicate shows "This property already exists"); on a failed save the focus moves to the first invalid field.
10. Property delete confirmation (`ConfirmDeleteDialog`): modal "Delete property", names the property, says it is deleted permanently and cannot be undone, buttons Cancel and Delete ("Deleting..." while busy). On failure: "Deleting failed. Please try again."
11. Account view (`AccountView`): button "Back to properties", heading "Account", name and email, and a "Danger zone" section (red border) with the explanation and the button "Delete account".
12. Delete account dialog (`DeleteAccountDialog`): modal "Delete account" with the email, the property count sentence, "This cannot be undone.", the field "Type DELETE to confirm", Cancel and a delete button that is enabled only when the typed text equals `DELETE` ([account deletion](../product/account-deletion.md)).
13. Behaviour at 390 px, as far as the code shows it: the page is one centred column (`max-w-3xl`) with `px-4 py-6`, growing to `px-6 py-10` from the `sm` breakpoint (640 px). The header row wraps (`flex-wrap`). The switcher stacks its select and button vertically below `sm`. Detail rows show label above value below `sm` and a three-column grid from `sm`. The property form is one column below `sm` and a six-column grid from `sm`. Detail action buttons share the row width below `sm`. Dialog buttons stack (Cancel last in the markup order, reversed visually) below `sm`; dialogs are `100% - 2rem` wide up to `max-w-md`.
14. Address search at 390 px: the suggestion list is in the normal flow directly below the field at full form width, wraps long addresses, and each suggestion has a minimum height of 2.75rem like the buttons. `e2e/tests/properties.spec.ts` checks the height and the absence of horizontal overflow with the list open.
15. What is tested: `e2e/tests/home.spec.ts` checks that the footer is visible and the page has no horizontal overflow at 390 px and at 1280 px. The Playwright mobile project uses the Pixel 7 device profile, which is not 390 px wide; its tests check that key buttons are in the viewport (`auth.spec.ts`, `account-deletion.spec.ts`). The sources make no other claim about the 390 px layout.

## Relations

- Property, Account, account deletion and app version are the concepts these screens show ([property](../product/property.md), [account](../product/account.md)).
- Shared styles: [UI patterns](ui-patterns.md).

## Code

- `web/src/AuthGate.tsx`, `web/src/App.tsx`
- `web/src/components/LoginScreen.tsx`, `EmptyState.tsx`, `PropertySwitcher.tsx`, `PropertyDetails.tsx`, `PropertyForm.tsx`, `ConfirmDeleteDialog.tsx`, `AccountView.tsx`, `DeleteAccountDialog.tsx`
- `e2e/tests/*.spec.ts`

## Decisions

- [003 Editing included](../decisions/property-editing-is-included.md)
- [004 Selection remembered per browser](../decisions/selected-property-remembered-per-browser.md)
- [009 Labelled test sign-in](../decisions/labelled-test-sign-in-fail-closed-in-production.md)
- [015 Account deletion](../decisions/account-deletion-is-permanent-with-typed-delete.md)

## Stories

- #18 footer, #20 property screens, #34 login screen, #46 Account view and dialog, #59 address search in the form.

## See Also

- [Address search](../product/address-search.md)
- [UI patterns](ui-patterns.md)
- [Property](../product/property.md)
- [Account deletion](../product/account-deletion.md)
- [App version and health status](../product/app-version.md)
- [Authentication](../architecture/authentication.md)
- [Home Maintenance Log](../product/home-maintenance-log.md)
- [Concept map](../index.md)
