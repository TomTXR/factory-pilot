---
summary: Hand-written forward-only migration runner, reason unknown (Data model)
---
# A hand-written SQL migration runner with forward-only files

> Sources: `api/src/db.ts`; `AGENTS.md` rule 5
> Raw: [Story 20 properties](../../raw/stories/2026-11-18-story-20-manage-properties.md)
> Status: accepted
> Updated: 2026-11-19

## Context

The schema needs versioned changes applied at API start-up.

## Decision

`migrate()` reads `api/migrations/*.sql` in name order and applies each file once, in a transaction, recording it in `schema_migrations`. Applied files are never edited; each schema change is a new file (`AGENTS.md` rule 5). There is no down migration.

## Reason

Reason: unknown. No issue comment or document explains why a migration library was not used.

## Alternatives

- A migration library: no source says whether it was considered.

## Affects

- [Data model](../architecture/data-model.md)
