# Account deletion

> Sources: Story #46, 2026-11-19; Story #63, 2026-11-19
> Raw: [Story 46 delete account](../../raw/stories/2026-11-19-story-46-delete-account.md); [Story 63](../../raw/stories/2026-11-19-story-63-document-current-app.md)
> Updated: 2026-11-19

## Purpose

A signed-in user can permanently delete their own account and everything in it, from the Account view.

## Rules

1. The Account view opens from the user name in the header. It shows name and email and a "Danger zone" with a "Delete account" button. Opening the view changes nothing.
2. The button is disabled until the property list has loaded, because the dialog states the number of properties.
3. A modal dialog names the account email, says that all properties (with their number, or that none exist) are permanently deleted and that this cannot be undone, and asks the user to type `DELETE`.
4. The dialog's delete button is enabled only when the typed text, trimmed, equals `DELETE` (case-sensitive). Cancel and Escape close the dialog and delete nothing.
5. The API route `DELETE /api/auth/account` needs a session and a body `{"confirm":"DELETE"}`; otherwise it answers 400. The user comes from the session only.
6. The account, all its sessions (every device) and all its properties are deleted in one transaction. There is no grace period, undo or export. The answer is 204 and the session cookie is cleared.
7. After deletion the web app clears the stored property selection and shows the login screen with "Your account has been deleted."
8. If deletion fails, the dialog shows an error and nothing is deleted.
9. The API logs the user id and the number of deleted properties, not the email or name.

## Relations

- Account: the record that is removed ([account](account.md)).
- Property: deleted explicitly with the account; the foreign key has no cascade on purpose ([016](../decisions/016-property-foreign-key-without-cascade.md)).
- Session: removed through the cascade on `sessions.user_id`.

## Code

- `api/src/authRoutes.ts`: `DELETE /account`.
- `api/src/authStores.ts`: `deleteAccount` (one transaction).
- `web/src/components/AccountView.tsx`, `DeleteAccountDialog.tsx`, `web/src/AuthGate.tsx`.
- `e2e/tests/account-deletion.spec.ts`: desktop uses test user `d`, mobile uses `e`.

## Decisions

- [015 Permanent, typed DELETE, one transaction](../decisions/015-account-deletion-is-permanent-with-typed-delete.md)
- [016 Foreign key without cascade](../decisions/016-property-foreign-key-without-cascade.md)

## Stories

- #46: account deletion.

## See Also

- [Screens](../design/screens.md)
- [Account](account.md)
- [Authentication](../architecture/authentication.md)
- [Property](property.md)
- [Home Maintenance Log](home-maintenance-log.md)
- [Concept map](../index.md)
