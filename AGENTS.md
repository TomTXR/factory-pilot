# AGENTS.md

Instructions for every coding agent (Claude Code, Codex, OpenHands) and every human working in this repo.

## What this repo is

`factory-pilot` is a throwaway pilot app for the DomiGO software factory spike. The factory turns GitHub issues (user stories) into tested, reviewed and deployed changes. The app itself is a small "Home Maintenance Log": properties, items, maintenance entries.

Data is always synthetic. Never add real personal data, real addresses of real people, or production data.

## Architecture

| Part | Path | Stack |
|------|------|-------|
| Web | `web/` | React 19, Vite, TypeScript (strict), Tailwind CSS v4, Vitest + Testing Library |
| API | `api/` | Node 24, Hono, TypeScript (strict), `postgres` client, Vitest |
| Database | - | PostgreSQL 17. Schema changes only through `api/migrations/NNN_name.sql` |
| E2E | `e2e/tests/` | Playwright, desktop and mobile viewport |
| Runtime | `docker-compose.yml` | `db`, `api`, `web` (nginx serves the SPA and proxies `/api` to `api`) |

The API exposes routes under `/api`. Routes are built in `api/src/app.ts` with injected dependencies, so they can be tested without a database.

## Commands

Run from the repo root.

| Command | Does |
|---------|------|
| `npm run setup` | Installs all dependencies (root, api, web) |
| `npm run lint` | ESLint on the whole repo |
| `npm run typecheck` | TypeScript checks for api and web |
| `npm test` | Unit tests for api and web |
| `npm run up` | Builds and starts the stack on http://localhost:8080 |
| `npm run e2e` | Playwright against `BASE_URL` (default http://localhost:8080) |
| `npm run down` | Stops the stack and deletes its data |

All of `lint`, `typecheck`, `test` and `e2e` must pass before a PR is ready. CI runs the same commands.

## Rules

1. TypeScript strict everywhere. No `any` unless commented why.
2. No `console.*`. Use `logger` from `api/src/logger.ts` (structured JSON). ESLint enforces this.
3. No emojis in code, comments, logs, commit messages or UI text.
4. Every behaviour change comes with tests: unit tests for logic and routes, a Playwright test for each user-visible flow.
5. Database: add a new migration file for each schema change. Never edit an applied migration.
6. Keep changes small and focused on the ticket. No unrelated refactors.
7. Keep existing comments when refactoring.
8. UI must work on a 390 px wide mobile screen and on desktop.
9. Commit messages: imperative mood, concise, describe what and why. No tool or AI attribution lines.
10. Never commit secrets. Configuration comes from environment variables.
11. If the ticket is unclear, ask in the issue instead of guessing.

## Pull requests

- One ticket, one PR. Reference the issue (`Closes #<n>`).
- PR description: what changed, why, how it was tested, anything the human reviewer should check on the preview.
- Each PR gets a preview at `https://pilot-pr-<n>.domigo.com` after CI passes.
- Merging to `main` deploys to `https://pilot.domigo.com`.

## Code Review Rules

Reviewers (human or agent) check, in this order:

1. **Correctness:** does the change do what the issue's acceptance criteria say? Are edge cases handled (empty input, invalid input, missing records)?
2. **Tests:** does every behaviour change have a test that would fail without it? Is there a Playwright test for new user-visible flows?
3. **Data safety:** migrations are additive and new files only; no data loss; inputs validated at the API boundary.
4. **Security:** no secrets in code, no SQL built by string concatenation (use the tagged `sql` template), no unvalidated user input in queries or HTML.
5. **Rules above:** logger instead of console, no emojis, strict types, mobile layout.

Report only real problems, ranked P0 (must fix: bug, data loss, security) and P1 (should fix: missing test, rule violation). Do not report style preferences.
