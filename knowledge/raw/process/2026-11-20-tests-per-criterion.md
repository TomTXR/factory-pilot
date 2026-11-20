# Tests: one per acceptance criterion, enforced by CI

> Source: Product owner direction and decisions, 2026-11-20; web research by the operator
> Collected: 2026-11-20
> Published: 2026-11-20
> Synthetic: no

The product owner asked whether each PR should add tests so that later changes are regression tested, and asked for the best practices and how to make them automatic in the factory. Added while the research ran: agents tend to overdo test suites, so tests must be well scoped, not "tons of tests".

State before: AGENTS.md rule 4 ("every behaviour change comes with tests: unit tests for logic and routes, a Playwright test for each user-visible flow") and reviewer rule 2. CI ran the whole suite on every PR (required checks `checks` and `e2e`). Nothing linked a test to a criterion, nothing limited the number of tests, and the rule had no merge blocker. 20 Playwright tests, 10 unit test files; no title named a story or criterion.

Research (operator, web, 2026-11-20; mostly practitioner and vendor sources, no standard):
- Every bug fix gets a test that fails before the fix and passes after it (CircleCI, Flagsmith regression testing guides).
- Test pyramid: fast unit tests carry most of the gating; suites heavy with end-to-end tests are slow and flaky (bug0, roadmap.sh).
- Suite bloat: every fix adds a test and nothing is deleted; prune as you go.
- Map each Given/When/Then criterion to one test, with the criterion ID in the test title; keep the requirement-to-test mapping as traceability (developertoolkit.ai "executable acceptance criteria", BMAD trace-requirements).
- Agent-written tests often check nothing; coverage does not show it, mutation testing does (Stryker incremental mode on changed code; VirtusLab, Test Double, tianpan.co).

Decisions (product owner):
- No separate "Tests" section in the plan: plans must stay short for the human. The numbered acceptance criteria are the test specification; the plans already number them. Test level and scope rules live in AGENTS.md, which the human does not review.
- A CI check enforces the link ("yes, we should do CI check"): on a factory story branch, every criterion of the newest agent plan needs a test title with `#<issue> AC<k>`, or a line `Not automated: AC<k> <reason>` in the story record. One title may name several criteria, which keeps the number of tests down.
- Scope limits are reviewer rules (P1): a test without a criterion or bug, a criterion tested at two levels, an end-to-end test where a unit test proves the same, a "Not automated" reason a test could cover.
- Mutation testing is deferred until the suite shows weak tests: it adds CI minutes and a tool.

Agent review of PR #68 (two P1, fixed): (1) only the first missing criterion reached the builder, because the CI-failure rework quotes only lines with FAIL; every missing criterion now has its own FAIL line. (2) A "Not automated" line in the PR description was never seen: editing a description starts no CI run, and a re-run reuses the old event. The line moved to the story record, a file in the PR.

Known limits: Existing tests keep their titles; the rule applies to stories built from now on. Criterion numbers must be unique within the plan (the plans number them continuously).
