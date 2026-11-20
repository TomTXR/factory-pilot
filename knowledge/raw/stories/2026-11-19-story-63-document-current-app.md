# Story 63: Document the current app in the knowledge wiki

> Source: GitHub issue #63, TomTXR/factory-pilot, approved plan (https://github.com/TomTXR/factory-pilot/issues/63) and `/approve` by the product owner
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

## Goal

The knowledge wiki describes the app as it is on `main` today: a correct concept map, one concept article per existing concept (product, architecture, design) and decision records for the choices taken in #18, #20, #28/#34, #35 and #46. Documentation only: no change to app code, migrations or tests.

## Acceptance criteria

The 19 criteria of the approved plan. In short: concept map with one row per existing concept and planned concepts marked as planned (1 to 4); concept articles with the sections of the concept template (5 to 6); architecture articles for system, data model, API and authentication (7 to 9); design articles for the screens and UI patterns, with the 390 px behaviour only as far as the code shows it (10 to 11); decision records, a superseded record and its replacement, unknown reasons stated as unknown, conflicting sources annotated (12 to 15); `AGENTS.md` architecture table matches the code (16); this story record (17); only `knowledge/` and `AGENTS.md` change (18); every statement traceable (19).

## Questions and answers

The plan asked two open questions. The product owner answered `/approve`, which accepts the proposed defaults:

1. Add story records for #18, #35 and #46 as backfilled raw sources? Yes. See [story 18](2026-11-18-story-18-version-footer.md), [story 35](2026-11-19-story-35-per-account-properties.md), [story 46](2026-11-19-story-46-delete-account.md), all marked as collected 2026-11-19.
2. One article each for property, account and account deletion? Yes.

## Decisions taken

- The builder (agent) numbered the decision records 001 to 019 in the order of the plan.
- Concept articles that share one code area share one article: Session, Sign-in with Google (with the test sign-in) and API access protection are in `architecture/authentication.md`; App version and health status are in `product/app-version.md`.
- The stale comment in `api/migrations/004_property_accounts.sql` (unowned rows are claimed) is annotated in the data model article and in decision records 013 and 014; the migration is not edited.

## Concepts documented

Property, Account, Session, Sign-in with Google, Account deletion, API access protection, App version and health status. Planned and not documented beyond the map: Item, Maintenance entry, GO category, Property sharing (#32).

## Findings recorded while checking the code

- The concept map table in `index.md` was broken: summary rows of the product articles were mixed into it. It was rewritten.
- `AGENTS.md` listed no auth, no `/api` route overview and no deploy; the architecture section now links to the architecture articles.
- Migration 004 comment contradicts the code and issue #35 (see above).
