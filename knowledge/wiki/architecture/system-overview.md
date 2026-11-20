# System overview

> Sources: code and configuration on `main`, checked 2026-11-19; Story #63
> Raw: [Story 63](../../raw/stories/2026-11-19-story-63-document-current-app.md)
> Updated: 2026-11-19

## Purpose

How the app is built and run: the parts, where they run, and how a change reaches production. Detail is in [data model](data-model.md), [API](api.md) and [authentication](authentication.md).

## Rules

1. Web: a React 19 single-page app built with Vite (`web/`). The production image serves it with nginx 1.29. nginx proxies `/api/` to `http://api:3000` and answers every other path with `index.html` (`web/nginx.conf`).
2. API: Node 24 and Hono (`api/`), listening on `PORT` (default 3000). Routes are built by `createApp` with injected dependencies ([017](../decisions/017-hono-app-with-injected-dependencies.md)). The container runs as user `node`.
3. Database: PostgreSQL 17 (`postgres:17-alpine`), database and user `pilot`. The API applies migrations at start-up and exits if one fails ([data model](data-model.md)).
4. Runtime, `docker-compose.yml`: services `db`, `api`, `web`. The web service is the only one with a host port (`WEB_PORT`, default 8080). The stack name is `COMPOSE_PROJECT_NAME` (default `pilot-dev`). Memory limits: db and api 256 MB, web 128 MB.
5. Environment variables by name: `POSTGRES_PASSWORD` (compose; default `pilot` locally), `DATABASE_URL` (api, required), `DEPLOY_PROJECT` (api; set from the compose project name), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (api; from `PILOT_GOOGLE_CLIENT_ID` and `PILOT_GOOGLE_CLIENT_SECRET`), `PUBLIC_BASE_URL` (api; fixed to the production URL in `docker-compose.yml`, not per stack), `PORT`, `LOG_LEVEL`, `WEB_PORT`. Secrets are never committed (`AGENTS.md` rule 10).
6. Local stack: `npm run up` builds and starts the compose stack on http://localhost:8080; `npm run down` removes it and its data. It has no Google settings, so it uses the labelled test sign-in ([009](../decisions/009-labelled-test-sign-in-fail-closed-in-production.md)).
7. CI (`.github/workflows/ci.yml`, on pull requests and pushes to `main`): job `checks` runs `npm run setup`, lint, typecheck, unit tests, the shell tests under `tests/` and, on pull requests, the knowledge check; job `e2e` starts the compose stack and runs Playwright with a desktop and a mobile project.
8. Deploy (`.github/workflows/deploy.yml`, `deploy-target.yml`): green CI on `main` deploys production, green CI on an open pull request deploys a preview, closing the pull request removes it. The workflow connects to the factory VM over SSH; a forced command (`deploy/server/pilot-deploy.sh`) accepts only `deploy prod <sha>`, `deploy pr <n> <sha>`, `destroy pr <n>` and `status`. The script checks out the commit, keeps a per-project env file with a generated `POSTGRES_PASSWORD`, and runs `docker compose up -d --build --wait` with `docker-compose.server.yml` on top. A smoke check polls `/api/health` for up to 30 tries 10 seconds apart.
9. App secrets named `PILOT_<NAME>` are passed to the production deploy only, on stdin; previews and CI never get them. Only values on one line are passed.
10. `docker-compose.server.yml` removes the host port and joins the web container to the external network `factory-edge` under the alias `pilot-prod-web` or `pilot-pr-<n>-web`.
11. Edge: Caddy on the factory VM (`deploy/server/edge/Caddyfile`). `pilot.domigo.com` goes to `pilot-prod-web:80`. `pilot-pr-<n>.domigo.com` goes to `pilot-pr-<n>-web:80`, with on-demand TLS allowed only for hosts matching `pilot-pr-<digits>.domigo.com` (checked by a local `ask` endpoint). Every other host answers 404. The factory host is behind basic auth.
12. Environments: production https://pilot.domigo.com; previews https://pilot-pr-<n>.domigo.com after CI passes on the pull request.

## Relations

- [Authentication](authentication.md) explains why previews show the test sign-in and production refuses to start without Google settings.
- [App version and health status](../product/app-version.md): the smoke check.
- [Process: story workflow](../process/story-workflow.md): how factory pull requests reach these environments.

## Code

- `docker-compose.yml`, `docker-compose.server.yml`
- `api/Dockerfile`, `web/Dockerfile`, `web/nginx.conf`
- `.github/workflows/ci.yml`, `deploy.yml`, `deploy-target.yml`, `preview-cleanup.yml`
- `deploy/server/pilot-deploy.sh`, `deploy/server/edge/Caddyfile`
- `e2e/tests/`, `playwright.config.ts`

## Decisions

- [009 Test sign-in and fail-closed start-up](../decisions/009-labelled-test-sign-in-fail-closed-in-production.md)
- [017 Hono app with injected dependencies](../decisions/017-hono-app-with-injected-dependencies.md)

## Stories

- #63: this article. The origin of the deploy set-up is not recorded in the wiki.

## See Also

- [Data model](data-model.md)
- [API](api.md)
- [Authentication](authentication.md)
- [App version and health status](../product/app-version.md)
- [Home Maintenance Log](../product/home-maintenance-log.md)
- [Concept map](../index.md)
