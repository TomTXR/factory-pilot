# UI patterns

> Sources: `web/src/index.css`, `web/src/components/`, checked 2026-11-19; Story #63
> Raw: [Story 63](../../raw/stories/2026-11-19-story-63-document-current-app.md)
> Updated: 2026-11-19

## Purpose

The shared styles and interaction patterns of the web app, so new screens look and behave like the existing ones. The app uses Tailwind CSS v4 and the component classes below, defined in `web/src/index.css`.

## Rules

1. Buttons: `btn-primary` (blue fill, main action), `btn-secondary` (white, grey border), `btn-danger` (white, red border and text, opens a destructive flow), `btn-danger-solid` (red fill, the final destructive confirmation). All have a minimum height of 2.75rem (`min-h-11`), a visible focus outline and a disabled style (reduced opacity, not-allowed cursor).
2. Form fields: `label` above `input` (`input` class: full width, minimum height 2.75rem, text size base, blue focus outline, red border when `aria-invalid="true"`). Every input has a `<label>`.
3. Inline field errors: a paragraph with `role="alert"` under the field, linked with `aria-describedby`, plus `aria-invalid` on the input. A form-level error is an alert at the top of the form. The form is `noValidate`: validation comes from the API.
4. Dialogs: the native `<dialog>` opened with `showModal()`, so the browser traps focus and Escape fires `cancel`. Escape and Cancel close it unless an action is busy. The dialog is labelled with `aria-labelledby` and `aria-describedby`, centred, `100% - 2rem` wide and at most `max-w-md`. Destructive dialogs use `btn-danger-solid` for the confirm.
5. Busy actions: the button is disabled and its label changes ("Deleting...").
6. Status and alerts: loading text uses `role="status"`; failures use `role="alert"` with a red card and a Retry button where a retry makes sense.
7. Destructive areas: a section with a red border and a red heading ("Danger zone"). Permanent deletion of a whole account needs a typed word; deletion of one property needs only a confirmation dialog.
8. Layout: one centred column, `max-w-3xl`; cards are white, rounded (`rounded-xl`), with a slate border. Login uses a narrower column (`max-w-md`).
9. Text: sentence case labels, no emojis (`AGENTS.md` rule 3). Amounts will be in EUR and dates day-month-year (requirement in the [overview](../product/home-maintenance-log.md); no UI shows them yet).
10. Every screen must work at 390 px and on desktop ([screens](screens.md), `AGENTS.md` rule 8).

## Relations

- Used by every screen in [screens](screens.md).

## Code

- `web/src/index.css`: `.label`, `.input`, `.btn-*`.
- `web/src/components/PropertyForm.tsx` (`Field`), `ConfirmDeleteDialog.tsx`, `DeleteAccountDialog.tsx`.

## Decisions

- None recorded. The choice of Tailwind is stated in `AGENTS.md`; no source gives a reason.

## Stories

- #20 form, dialog and buttons; #34 login; #46 dialog with typed confirmation and danger zone.

## See Also

- [Screens](screens.md)
- [Concept map](../index.md)
