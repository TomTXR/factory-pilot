# Project knowledge: every change updates the wiki

> Source: Product owner decision in the factory spike session, 2026-11-19 (operator notes)
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

## Finding

The product owner asked whether the agents write documentation so that future agents understand the structure and the key decisions. Check of the repository on 2026-11-19:

- Product answers were captured for stories #20 and #34 (story records and product articles).
- Story #35 (PR #45) had no story record. The rule said "when a story is done, run capture": after the merge no agent runs, so nobody did it.
- The code structure was not documented: the architecture table in AGENTS.md was the v0 version and did not mention auth, sessions, accounts or property ownership (migrations 003, 004).
- Technical decisions (session lifetime, ownership per account) were in no article. The wiki had no architecture, design or decision area.
- The factory process and lessons were written by the operator, not by the factory agents.

Root cause: the instructions asked only for product answers, only after the story, with no owner and no check.

## Product owner decisions

1. No human reviews the documentation. Every agent updates the wiki with the work it did, creating or updating articles.
2. A prescribed structure, like the DomiGO v1 docs (not necessarily the same): product concepts, software architecture, design concepts and assets.
3. Every deploy must carry these updates, so that future agents do not need to read the full source code and, more importantly, have the bigger picture: which concepts exist and how they relate.
4. An agent that starts work on a story or a plan reads the relevant articles first.
5. Agents do not read only the files named for their task; they decide what is relevant themselves. The index is the key. Model it on the Infercom wiki skill, which works well: the index is the single entry point with a one-line summary per article; the agent reads the whole index and picks the articles.
6. Document this topic in its own wiki article, "how project knowledge is managed".

## Design taken

- Topics: product, architecture, design (with assets), decisions, users, process, lessons. Domain merged into product (its only article described a product concept).
- index.md is the single entry point: concept map first (diagram and table of concepts, relations, articles, code entry points), then all articles with summaries.
- Plan section "Knowledge updates" names the expected updates; "Context used" is a minimum for builder and reviewer, not a limit.
- The builder updates the wiki and writes the story record in the story's own PR, on every rework and revision.
- Enforcement: a step in the required CI check fails when app code changes without a wiki change, or a factory PR has no story record; a red check goes back to the builder automatically. The agent reviewer treats a missing or wrong update as P1.
- Why in the PR and not after the deploy: every deploy is a merged PR, so code and knowledge land in one commit and cannot drift; nothing has to run after the merge.
- Backfill of the existing concepts (auth, sessions, accounts, ownership) goes through the factory as a story, which tests the new rules.
