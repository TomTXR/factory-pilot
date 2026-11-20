---
summary: Tests as the regression suite: one test per acceptance criterion with its ID in the title, lowest test level, no extra tests, "Not automated" escape, CI criteria check, reviewer scope rules, why
---
# Testing

> Sources: Product owner decisions, 2026-11-20; web research on regression testing practice
> Raw: [Tests per criterion](../../raw/process/2026-11-20-tests-per-criterion.md)
> Updated: 2026-11-20

## Overview

Every test is part of the regression suite. CI runs all tests on every PR, so a test written for one story protects that behaviour from every later story. The aim is few tests that prove the story, not many tests that repeat each other. The rules are in AGENTS.md, section Tests; this article says why.

## How a story becomes tests

| Step | Who | What |
|------|-----|------|
| Plan | Breakdown agent | Numbered Given/When/Then acceptance criteria. They are the test specification; the plan has no separate test section |
| Build | Builder | One test per criterion, ID at the start of the title: `#46 AC4: ...`. One title may name several: `#46 AC6, AC7: ...`. A bug fix gets one test that fails without the fix |
| CI | `criteria-check.sh` (required check `checks`) | On `factory/issue-<n>`: reads the newest agent plan of #n and fails for every criterion without a test title or a `Not automated: AC<k> <reason>` line in the story record. Every missing criterion gets its own `FAIL` line, so the CI-failure rework sends all of them to the builder at once |
| Review | Agent reviewer | Test level, test fails without the change, no extra tests (see below) |
| Human review | Approver | Checks the "Not automated" criteria on the preview |

## Test levels

| Level | Tool | Use for |
|-------|------|---------|
| Unit and route | Vitest (`api/`, `web/`) | Logic, validation, API routes with injected dependencies. The default |
| End-to-end | Playwright, desktop and mobile | A flow across web, API and database, or browser behaviour. At most one test per user flow |

The reviewer reports as P1: a test that maps to no criterion and no bug, a criterion tested at two levels, an end-to-end test where a unit test proves the same, a "Not automated" reason that a test could cover. No tests of library behaviour, no snapshot tests. A story that changes old behaviour changes or deletes the old test.

## Why

- **Link every test to a criterion.** This gives each test a reason to exist and limits the number of tests. Agents tend to write too many tests; a test without a criterion is visible in review.
- **CI check, not only a rule.** The wiki duty only held once CI enforced it ([Project Knowledge](project-knowledge.md)). The same applies here.
- **No test section in the plan.** Plans must stay short for the human; the criteria already describe the tests, and test design rules belong in AGENTS.md, which the human does not review.
- **Lowest level.** Unit tests are fast and stable; end-to-end tests are slow and flaky. The pyramid keeps CI short.
- **Mutation testing deferred.** It shows tests that check nothing, which coverage does not. It costs CI minutes and a new tool; add it when the suite shows weak tests.

## Limits

- "Not automated" lines live in the story record, a file in the PR, not in the PR description: editing a description starts no CI run, so a line there would never be seen.
- Tests written before 2026-11-20 have no IDs and keep their titles.
- The check traces criteria to titles; whether a test really proves its criterion is the reviewer's job.

## See Also

- [Story Workflow](story-workflow.md)
- [Project Knowledge](project-knowledge.md)
- [Factory Spike Lessons](../lessons/factory-spike-lessons.md)
