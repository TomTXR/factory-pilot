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
| Database | `api/migrations/` | PostgreSQL 17. Schema changes only through new files `api/migrations/YYYYMMDDTHHMM_name.sql` (UTC creation time), applied at API start-up in name order |
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
| `knowledge/wiki/index.md` | The entry point. First the concept map (every concept, its relations, its article, its code entry point), then every article with a one-line summary. Start here. Generated from the articles' front matter (`npm run wiki:index`); never edit it by hand. |
| `knowledge/wiki/product/` | Product concepts and features: purpose, rules, status |
| `knowledge/wiki/architecture/` | How the software is built: system, data model, API, auth, deploy |
| `knowledge/wiki/design/` | Design concepts, UI patterns, screens; small assets in `design/assets/` |
| `knowledge/wiki/decisions/` | One record per product or technical decision: context, decision, reason, alternatives |
| `knowledge/wiki/users/` | Who uses the app |
| `knowledge/wiki/process/`, `lessons/` | How the factory works and why |

Every agent, every story:

1. **Read first.** Before you plan, build or review, read all of `knowledge/wiki/index.md`. Decide from the concept map and the summaries which articles are relevant to your task, and read them. The plan lists the ones it used under "Context used": that is a minimum for the builder and the reviewer, not a limit. Read code where the articles point to it. If the wiki has no answer to a product question, ask in the issue; do not guess.
2. **Update with the work.** The PR that changes the app also updates the wiki, in a separate commit: create or update the articles of every concept you added or changed, and every other article the change makes wrong (cascade), update their front matter (summary, concepts, relations) and run `npm run wiki:index`, and add a decision record for every decision taken (by the human in the issue or by you in the code). The plan lists the expected updates under "Knowledge updates". Do this again on every rework and revision.
3. **Record the story.** The PR also adds the story record `knowledge/raw/stories/YYYY-MM-DD-story-<n>-<slug>.md` (wiki skill, operation **record**).
4. CI enforces 2 and 3: the required check fails when app code changes without a wiki update, or when a factory PR has no story record. The agent reviewer checks that the wiki matches the change. No human reviews the wiki.
5. Never edit a file in `knowledge/raw/` after it is merged. Until the merge, the story record of your own PR may be edited.

## Rules

1. TypeScript strict everywhere. No `any` unless commented why.
2. No `console.*`. Use `logger` from `api/src/logger.ts` (structured JSON). ESLint enforces this.
3. No emojis in code, comments, logs, commit messages or UI text.
4. Every behaviour change comes with tests, as section Tests says.
5. Database: add a new migration file for each schema change, named `YYYYMMDDTHHMM_name.sql` with the current UTC time. Never edit an applied migration.
6. Keep changes small and focused on the ticket. No unrelated refactors.
7. Keep existing comments when refactoring.
8. UI must work on a 390 px wide mobile screen and on desktop.
9. Commit messages: imperative mood, concise, describe what and why. No tool or AI attribution lines.
10. Never commit secrets. Configuration comes from environment variables.
11. App secrets (API keys, OAuth clients) are repository secrets named `PILOT_<NAME>`. Production gets them through the deploy; previews, CI and local runs do not. Map them in `docker-compose.yml` (for example `GOOGLE_CLIENT_ID: ${PILOT_GOOGLE_CLIENT_ID:-}`). The app must work without them where possible (test path, clearly labelled) and otherwise fail with a clear log line, never run unprotected.
12. Work only a human can do (accounts, external consoles, credentials) is a human task of the story, a sub-issue labelled `factory:human-task`. Never ask for secret values in issues, comments or pull requests. If you find a missing human task while building, describe it under "Human tasks needed" in the pull request description.
13. If the ticket is unclear, or you decide not to build it (for example it depends on a story that is not merged yet), do not guess and never stop silently: post a comment on the issue that says why and what is needed, then add the label `factory:blocked` (`gh issue edit <n> --add-label factory:blocked`). The factory then asks the story's owner. The same applies to a revision that needs no code change: say why in a comment and add `factory:blocked`. A run that ends without a push and without this comment looks like a stall.

## Tests

Tests are the regression suite: CI runs all of them on every PR, so each test protects its behaviour from later stories. Write few tests that prove the story, not many tests that repeat each other.

1. **One test per acceptance criterion.** The plan numbers the criteria. Put the criterion ID at the start of the test title: `test('#46 AC4: the dialog names the email and the number of properties', ...)`. One test may prove several criteria: `'#46 AC6, AC7: ...'`. If an existing test already proves a criterion, add the ID to its title instead of writing a new test: `'#46 AC4, #59 AC13: ...'`. Otherwise untouched old tests keep their titles.
2. **Lowest level that proves it.** Logic and API routes: a unit or route test (Vitest). Playwright only for a flow that crosses web, API and database or depends on the browser, at most one test per user flow. Do not test the same criterion at two levels.
3. **A bug fix gets one regression test** that fails without the fix. Run it once against the unchanged code to see it fail.
4. **No extra tests.** No test without a criterion or a bug, no tests of library or framework behaviour, no snapshot tests. Change or delete an existing test when the story changes its behaviour; do not keep it next to the new one.
5. **Not automatable:** only if no test can check a criterion (for example a colour judged by eye), never because other tests already cover it, add a line `Not automated: AC<k> <reason>` to the story record (`knowledge/raw/stories/*-story-<n>-*.md`). The human checks it on the preview.
6. CI enforces 1 and 5 on factory PRs (`.github/scripts/criteria-check.sh`): every criterion of the newest plan needs a test title with its ID or a "Not automated" line in the story record. The agent reviewer checks 2 to 4.

## Parallel work

Several stories are built at the same time, each in its own branch. Git merges line by line and reports a conflict only when two branches change the same or adjacent lines. These rules apply to every file, so that the only conflicts left are real ones:

1. **No running numbers.** Never name or number a new file, record or entry "the next number": two branches take the same one and git reports nothing. Name by content (`decisions/server-side-sessions.md`), by UTC time (`api/migrations/20261120T0815_add_items.sql`) or by a number GitHub assigns (`story-<issue>`).
2. **No shared lists edited by hand.** Put each item in its own file. Lists of items are generated: `knowledge/wiki/index.md` (`npm run wiki:index`), `package-lock.json` (`npm install`). On a merge conflict in a generated file, take either side and regenerate; never merge it by hand.
3. **Real conflicts:** when `main` and your branch changed the same code or article, merge `main`, keep both intents, and run all checks. CI always runs on the branch brought up to date with `main`, so changes that merge cleanly but break each other are caught there.

## Pull requests

- One ticket, one PR. Reference the issue (`Closes #<n>`).
- PR description: what changed, why, how it was tested, the wiki articles read ("Context used") and updated, anything the human reviewer should check on the preview.
- Each PR gets a preview at `https://pilot-pr-<n>.domigo.com` after CI passes.
- Merging to `main` deploys to `https://pilot.domigo.com`.

## Code Review Rules

Reviewers (human or agent) check, in this order:

1. **Correctness:** does the change do what the issue's acceptance criteria say? Are edge cases handled (empty input, invalid input, missing records)?
2. **Tests:** does each criterion's test fail without the change? Is it at the lowest level that proves it (section Tests)? A missing test is a P1. So is a new test that maps to no criterion or bug, a criterion tested twice at different levels, or a "Not automated" reason that a test could cover or that points to existing tests (their titles get the ID instead).
3. **Data safety:** migrations are additive and new files only; no data loss; inputs validated at the API boundary.
4. **Security:** no secrets in code, no SQL built by string concatenation (use the tagged `sql` template), no unvalidated user input in queries or HTML.
5. **Rules above:** logger instead of console, no emojis, strict types, mobile layout.
6. **Knowledge:** behaviour that contradicts `knowledge/wiki/` is a P1 unless the issue explicitly changes it. The wiki must describe the code after this PR: a new or changed concept without an updated article and concept map entry, a decision without a decision record, or an article that does not match the code is a P1. Review the wiki as part of the PR; a human does not.
7. **Human tasks:** a new required secret or external setup that no human task of the story covers is a P1 (name it in the review so the human can add it). A secret value in code, a comment or a PR is a P0.

Report only real problems, ranked P0 (must fix: bug, data loss, security) and P1 (should fix: missing test, rule violation). Do not report style preferences.
