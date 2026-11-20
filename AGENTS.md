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
| Database | `api/migrations/` | PostgreSQL 17. Schema changes only through `api/migrations/NNN_name.sql`, applied at API start-up |
| Auth | `api/src/auth*.ts`, `api/src/googleClient.ts` | Sign in with Google, server-side sessions; labelled test sign-in on local, CI and preview stacks |
| E2E | `e2e/tests/` | Playwright, desktop and mobile viewport |
| Runtime | `docker-compose.yml` | `db`, `api`, `web` (nginx serves the SPA and proxies `/api` to `api`) |
| Deploy | `deploy/server/`, `.github/workflows/` | Production `https://pilot.domigo.com`, previews `https://pilot-pr-<n>.domigo.com`, Caddy edge proxy, deploy over a forced SSH command |

The API exposes routes under `/api`. Routes are built in `api/src/app.ts` with injected dependencies, so they can be tested without a database. How it fits together: [system overview](knowledge/wiki/architecture/system-overview.md), [data model](knowledge/wiki/architecture/data-model.md), [API](knowledge/wiki/architecture/api.md), [authentication](knowledge/wiki/architecture/authentication.md).

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
| `bash tests/factory-flow.test.sh` | Tests the factory state transitions (`.github/scripts/factory-flow.sh`) with a stubbed `gh` |

All of `lint`, `typecheck`, `test` and `e2e` must pass before a PR is ready. CI runs the same commands.

## Knowledge

`knowledge/` is the project's shared knowledge wiki. It holds the big picture, so that agents do not need to read the full source code: which concepts exist, how they relate, how they are built and why. How to read and write it: `.agents/skills/wiki/SKILL.md` (also available as the `wiki` skill).

| Place | Holds |
|-------|-------|
| `knowledge/wiki/index.md` | The entry point. First the concept map (every concept, its relations, its article, its code entry point), then every article with a one-line summary. Start here. |
| `knowledge/wiki/product/` | Product concepts and features: purpose, rules, status |
| `knowledge/wiki/architecture/` | How the software is built: system, data model, API, auth, deploy |
| `knowledge/wiki/design/` | Design concepts, UI patterns, screens; small assets in `design/assets/` |
| `knowledge/wiki/decisions/` | One record per product or technical decision: context, decision, reason, alternatives |
| `knowledge/wiki/users/` | Who uses the app |
| `knowledge/wiki/process/`, `lessons/` | How the factory works and why |

Every agent, every story:

1. **Read first.** Before you plan, build or review, read all of `knowledge/wiki/index.md`. Decide from the concept map and the summaries which articles are relevant to your task, and read them. The plan lists the ones it used under "Context used": that is a minimum for the builder and the reviewer, not a limit. Read code where the articles point to it. If the wiki has no answer to a product question, ask in the issue; do not guess.
2. **Update with the work.** The PR that changes the app also updates the wiki, in a separate commit: create or update the articles of every concept you added or changed, and every other article the change makes wrong (cascade), update the concept map and the summaries in `index.md`, and add a decision record for every decision taken (by the human in the issue or by you in the code). The plan lists the expected updates under "Knowledge updates". Do this again on every rework and revision.
3. **Record the story.** The PR also adds the story record `knowledge/raw/stories/YYYY-MM-DD-story-<n>-<slug>.md` (wiki skill, operation **record**).
4. CI enforces 2 and 3: the required check fails when app code changes without a wiki update, or when a factory PR has no story record. The agent reviewer checks that the wiki matches the change. No human reviews the wiki.
5. Never edit a file in `knowledge/raw/` after it is merged. Until the merge, the story record of your own PR may be edited.

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
11. App secrets (API keys, OAuth clients) are repository secrets named `PILOT_<NAME>`. Production gets them through the deploy; previews, CI and local runs do not. Map them in `docker-compose.yml` (for example `GOOGLE_CLIENT_ID: ${PILOT_GOOGLE_CLIENT_ID:-}`). The app must work without them where possible (test path, clearly labelled) and otherwise fail with a clear log line, never run unprotected.
12. Work only a human can do (accounts, external consoles, credentials) is a human task of the story, a sub-issue labelled `factory:human-task`. Never ask for secret values in issues, comments or pull requests. If you find a missing human task while building, describe it under "Human tasks needed" in the pull request description.
13. If the ticket is unclear, or you decide not to build it (for example it depends on a story that is not merged yet), do not guess and never stop silently: post a comment on the issue that says why and what is needed, then add the label `factory:blocked` (`gh issue edit <n> --add-label factory:blocked`). The factory then asks the story's owner. The same applies to a revision that needs no code change: say why in a comment and add `factory:blocked`. A run that ends without a push and without this comment looks like a stall.

## Pull requests

- One ticket, one PR. Reference the issue (`Closes #<n>`).
- PR description: what changed, why, how it was tested, the wiki articles read ("Context used") and updated, anything the human reviewer should check on the preview.
- Each PR gets a preview at `https://pilot-pr-<n>.domigo.com` after CI passes.
- Merging to `main` deploys to `https://pilot.domigo.com`.

## Code Review Rules

Reviewers (human or agent) check, in this order:

1. **Correctness:** does the change do what the issue's acceptance criteria say? Are edge cases handled (empty input, invalid input, missing records)?
2. **Tests:** does every behaviour change have a test that would fail without it? Is there a Playwright test for new user-visible flows?
3. **Data safety:** migrations are additive and new files only; no data loss; inputs validated at the API boundary.
4. **Security:** no secrets in code, no SQL built by string concatenation (use the tagged `sql` template), no unvalidated user input in queries or HTML.
5. **Rules above:** logger instead of console, no emojis, strict types, mobile layout.
6. **Knowledge:** behaviour that contradicts `knowledge/wiki/` is a P1 unless the issue explicitly changes it. The wiki must describe the code after this PR: a new or changed concept without an updated article and concept map entry, a decision without a decision record, or an article that does not match the code is a P1. Review the wiki as part of the PR; a human does not.
7. **Human tasks:** a new required secret or external setup that no human task of the story covers is a P1 (name it in the review so the human can add it). A secret value in code, a comment or a PR is a P0.

Report only real problems, ranked P0 (must fix: bug, data loss, security) and P1 (should fix: missing test, rule violation). Do not report style preferences.
