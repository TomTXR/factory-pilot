---
summary: `/api/version`, footer text, `/api/health` answers, API status badge, use in the deploy smoke check
concepts:
  - name: App version and health status
    code: api/src/app.ts, api/src/server.ts, web/src/api.ts, web/src/App.tsx
---
# App version and health status

> Sources: Story #18, 2026-11-18; Story #63, 2026-11-19
> Raw: [Story 18 version footer](../../raw/stories/2026-11-18-story-18-version-footer.md); [Story 63](../../raw/stories/2026-11-19-story-63-document-current-app.md)
> Updated: 2026-11-19

## Purpose

Two public signals show which build runs and whether the API and database answer: the version in the footer and the API status badge in the header. The deploy smoke check uses the health route.

## Rules

1. `GET /api/version` returns `{"version": "<x.y.z>"}`, the `version` of `api/package.json`. It is public.
2. The footer shows "Version x.y.z", or "Version unknown" when the request fails, is not 2xx or has no string `version`. While the request is in flight the footer shows nothing.
3. `GET /api/health` is public. It answers 200 `{"status":"ok","db":true}` when `select 1` succeeds and 503 `{"status":"degraded","db":false}` when it fails or throws.
4. The header badge shows `API: loading | ok | degraded | unreachable`. Any answer other than status `ok` is `degraded`; a network error is `unreachable`.
5. The health route is used by the container health checks and by the deploy smoke check, which polls `https://<host>/api/health` for `"status":"ok"` ([system overview](../architecture/system-overview.md)).

## Relations

- API access protection: these routes stay public ([authentication](../architecture/authentication.md)).
- The footer and the badge are in the shared layout ([screens](../design/screens.md)).

## Code

- `api/src/app.ts`: `/health`, `/version`.
- `api/src/server.ts`: reads the version from `api/package.json`.
- `web/src/api.ts`: `fetchHealth`, `fetchVersion`.
- `web/src/App.tsx`: badge and footer.
- `e2e/tests/home.spec.ts`: footer on desktop and on a 390 px phone.

## Decisions

- [019 Version from api/package.json](../decisions/app-version-from-api-package-json.md)

## Stories

- #18: version in the footer. The status badge predates the stories in the wiki; its origin is not recorded.

## See Also

- [System overview](../architecture/system-overview.md)
- [API](../architecture/api.md)
- [Screens](../design/screens.md)
- [Home Maintenance Log](home-maintenance-log.md)
- [Concept map](../index.md)
