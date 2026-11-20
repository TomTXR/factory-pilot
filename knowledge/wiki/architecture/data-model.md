# Data model

> Sources: `api/migrations/001_init.sql` to `004_property_accounts.sql`, `api/src/db.ts`, checked 2026-11-19; Story #63
> Raw: [Story 35 per-account properties](../../raw/stories/2026-11-19-story-35-per-account-properties.md); [Story 63](../../raw/stories/2026-11-19-story-63-document-current-app.md)
> Updated: 2026-11-19

## Purpose

The tables of the PostgreSQL database, their constraints, and how migrations are applied.

## Rules

1. `app_info` (key text primary key, value text not null): created by migration 001 as a baseline. No code reads or writes it today.
2. `properties`: `id` uuid primary key (default `gen_random_uuid()`); `display_name`, `property_type`, `year_built`, `living_area_m2` numeric(8,2), `rooms`, `notes` are nullable; `street`, `house_number`, `postal_code`, `city`, `owner_name`, `country` (default NL), `house_number_addition` (default empty) are not null; `created_at`, `updated_at` default now; `account_user_id` uuid, nullable, references `users(id)` (added by 004).
3. Check constraints on `properties`: required text not blank after trim; country in NL, DE; type in house, apartment, other; year 1500 to 2100; area above 0; rooms above 0. The API is stricter (year up to the current year, area at most 100000, rooms at most 1000).
4. Unique index `properties_account_identity_idx` on (`account_user_id`, then street, house number, addition, postal code, city, lower-cased and whitespace-collapsed, country, owner name likewise). It must match `normaliseKey` in `api/src/properties.ts`. Rows with a null account never equal each other here. Index `properties_account_user_id_idx` on `account_user_id`. Migration 004 drops the older global `properties_identity_idx` ([The duplicate check applies per account](../decisions/duplicate-check-per-account.md)).
5. `users`: `id` uuid primary key; `google_sub` text not null unique; `email`, `display_name` not null; `created_at`, `last_login_at`.
6. `sessions`: `id` uuid primary key; `token_hash` text not null unique (SHA-256 hex of the cookie token); `user_id` uuid not null references `users(id)` on delete cascade; `created_at`, `last_used_at`, `expires_at`. Index `sessions_expires_at_idx`.
7. Foreign keys: `sessions.user_id` cascades. `properties.account_user_id` does not cascade, on purpose; account deletion removes the properties explicitly first ([properties.account_user_id has no cascade on delete, sessions.user_id has one](../decisions/property-foreign-key-without-cascade.md)).
8. `schema_migrations` (name text primary key, applied_at): created by the runner, one row per applied file.
9. Migrations: `001_init.sql` creates `app_info`; `002_properties.sql` creates `properties`, its checks and the global identity index; `003_users_sessions.sql` creates `users`, `sessions` and the expiry index; `004_property_accounts.sql` adds `properties.account_user_id`, its index, the per-account unique index and drops the global one.
10. Runner (`migrate` in `api/src/db.ts`): creates `schema_migrations`, lists `*.sql` files, sorts by name, skips applied names, and applies each remaining file with `tx.unsafe` in one transaction together with the insert into `schema_migrations`. It runs at API start-up; a failure stops the API. Applied files are never edited ([A hand-written SQL migration runner with forward-only files](../decisions/hand-written-migration-runner.md)).
11. Conflict, annotated: the comment in `004_property_accounts.sql` says rows created before the migration "have no account until the first account signs in and claims them". The code has no claim. The product owner dropped the claim on #35 ([Properties without an owner are never claimed automatically](../decisions/unowned-properties-never-claimed-automatically.md), source: https://github.com/TomTXR/factory-pilot/issues/35#issuecomment-7013278032). Unowned rows are invisible to every account. The migration was applied and is not edited.

## Relations

- Property rows: [property](../product/property.md). Users and sessions: [account](../product/account.md), [authentication](authentication.md).
- Items and maintenance entries have no tables yet ([overview](../product/home-maintenance-log.md)).

## Code

- `api/migrations/001_init.sql`, `002_properties.sql`, `003_users_sessions.sql`, `004_property_accounts.sql`
- `api/src/db.ts`: connection (`postgres`, at most 5 connections), `migrate`, `checkDb`.
- `api/src/propertyRepository.ts`, `api/src/authStores.ts`: queries.

## Decisions

- [012 Duplicate check per account](../decisions/duplicate-check-per-account.md)
- [014 Unowned properties never claimed](../decisions/unowned-properties-never-claimed-automatically.md)
- [016 Foreign key without cascade](../decisions/property-foreign-key-without-cascade.md)
- [018 Hand-written migration runner](../decisions/hand-written-migration-runner.md)

## Stories

- #20: `properties`. #34: `users`, `sessions`. #35: account ownership.

## See Also

- [System overview](system-overview.md)
- [Property](../product/property.md)
- [API](api.md)
- [Authentication](authentication.md)
- [Home Maintenance Log](../product/home-maintenance-log.md)
- [Concept map](../index.md)
