---
summary: Routes with method, public or protected, status codes, error bodies, dependency injection, logging
---
# API

> Sources: `api/src/app.ts`, `api/src/authRoutes.ts`, checked 2026-11-19; Story #63
> Raw: [Story 63](../../raw/stories/2026-11-19-story-63-document-current-app.md)
> Updated: 2026-11-19

## Purpose

The HTTP routes under `/api`, which are public and which need a session, and the status codes they answer.

## Rules

1. All routes are under `/api` (a Hono app with `basePath('/api')`). nginx forwards `/api/` to the API.
2. An unhandled error is logged with the logger and answered with 500 `{"error":"Internal server error"}`.
3. Public routes: `GET /health` (200 ok, 503 degraded), `GET /version` (200), `GET /auth/config` (200 `{mode}`), `GET /auth/login` (302 to Google; 404 in test mode), `GET /auth/callback` (302 to `/` on success, to `/?auth_error=1` on any failure), `POST /auth/test-login` (200 user; 404 in google mode; 400 unknown test user), `POST /auth/logout` (204, ends the session when there is one).
4. Protected routes answer 401 `{"error":"Not signed in"}` without a valid session: `GET /auth/me` (200 user), `DELETE /auth/account` (204; 400 without `confirm: "DELETE"`), and every `/properties` route.
5. `GET /properties` 200 list of the account's properties, ordered by creation. `POST /properties` 201 created, 400 `{errors}` per field, 409 duplicate. `GET /properties/:id` 200 or 404. `PUT /properties/:id` 200, 400, 404 or 409. `DELETE /properties/:id` 204 or 404. An id that is not a UUID answers 404; for `PUT` validation runs first, so an invalid body on a bad id answers 400.
6. Another account's property id answers 404 with `{"error":"Property not found"}`, the same as an unknown id ([A property belongs to exactly one account, other accounts get 404](../decisions/property-belongs-to-one-account-others-get-404.md)).
7. A 409 body is `{"error":"This property already exists"}`; a 400 body is `{"errors":{"<field>":"<message>"}}`.
8. `createApp(deps)` takes `checkDb`, `properties` (repository), `version`, `auth` (mode, Google client, user and session stores) and an optional clock. Tests pass fakes, so no database is needed ([The API is a Hono app with injected dependencies](../decisions/hono-app-with-injected-dependencies.md)).
9. Logging uses `logger` (`api/src/logger.ts`, JSON lines, `LOG_LEVEL`). Events logged include migrations applied, start-up, failed or rejected Google sign-ins, and deleted accounts (user id and number of properties only).

## Relations

- Property rules: [property](../product/property.md). Sign-in routes: [authentication](authentication.md). Health and version: [app version and health status](../product/app-version.md).

## Code

- `api/src/app.ts`: composition and property routes.
- `api/src/authRoutes.ts`: auth routes and `requireUser`.
- `api/src/properties.ts`: validation.
- `api/src/server.ts`: wiring and start-up.

## Decisions

- [011 One account per property, 404 for others](../decisions/property-belongs-to-one-account-others-get-404.md)
- [017 Hono app with injected dependencies](../decisions/hono-app-with-injected-dependencies.md)

## Stories

- #20: property routes. #34: auth routes and protection. #35: per-account scoping. #46: `DELETE /auth/account`.

## See Also

- [Authentication](authentication.md)
- [Data model](data-model.md)
- [Property](../product/property.md)
- [App version and health status](../product/app-version.md)
- [System overview](system-overview.md)
- [Home Maintenance Log](../product/home-maintenance-log.md)
- [Concept map](../index.md)
