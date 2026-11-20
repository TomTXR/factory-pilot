---
summary: How the wiki is structured, read and updated: index generated from article front matter, concept map, topics, who writes what in every PR, CI checks, reviewer duty, rules for parallel PRs (no running numbers, generated lists, regenerate on conflict), why
---
# Project Knowledge

> Sources: Product owner decisions in the factory spike, 2026-11-19
> Raw: [Project knowledge duty](../../raw/process/2026-11-19-project-knowledge-duty.md); [Wiki log removed](../../raw/process/2026-11-20-wiki-log-removed.md); [Wiki layout for parallel PRs](../../raw/process/2026-11-20-wiki-parallel-layout.md); [Parallel work rules](../../raw/process/2026-11-20-parallel-work-rules.md)
> Updated: 2026-11-20

## Overview

The wiki in `knowledge/` is the project's memory. Its main reader is the next agent. It must understand which concepts exist, how they relate, how they are built and why, without reading the full source code. Every agent reads it before it works and updates it with the work it did. CI enforces the update. No human reviews it.

## Structure

| Place | Holds |
|-------|-------|
| `wiki/index.md` | The single entry point: concept map, then every article with a one-line summary. Generated from the articles' front matter |
| `wiki/product/` | Product concepts and features: purpose, rules, status, relations |
| `wiki/architecture/` | How the software is built: system, data model, API, auth, deploy |
| `wiki/design/` | Design concepts, UI patterns, screens; small SVG/PNG in `design/assets/` |
| `wiki/decisions/` | One record per decision: context, decision, reason, alternatives, affected concepts |
| `wiki/users/` | Personas and their needs |
| `wiki/process/`, `wiki/lessons/` | How the factory works and why its rules exist |
| `raw/` | Immutable sources, including one story record per story |

The pattern is the Karpathy LLM wiki, modelled on the Infercom wiki skill: sources go into `raw/`, agents compile them into articles, and one source updates every affected article (cascade). The rules are in `.agents/skills/wiki/SKILL.md`; templates for concept, decision and general articles are next to it.

## Reading

1. Every agent (plan, build, review, task answers) reads all of `index.md` first.
2. From the concept map and the summaries it decides which articles are relevant to its task and reads them. Then it reads the code they point to.
3. The plan lists the articles it used under "Context used". For the builder and the reviewer this is a minimum, not a limit.

Why the index and not a list per task: an agent that reads only the files named for its task misses the concepts its change touches. One page with every concept and every summary lets it see the bigger picture at low cost. The summaries must be good enough to decide relevance without opening the article.

## Writing

| Who | When | What |
|-----|------|------|
| Breakdown agent | In the plan | Section "Knowledge updates": which articles the build creates or changes, and which decisions get a record |
| Builder | In the story's own PR, on every rework and revision | Concept articles, decision records, cascade to affected articles, concept map and summaries in the index, story record in `raw/stories/` |
| Agent reviewer | Every review | A concept change without an article, a decision without a record, or an article that does not match the code is a P1 |
| CI (required check `checks`) | Every PR | Fails when app code changes without a wiki change, or a factory PR has no story record. The PR goes back to the builder automatically |
| Human | Never | Reads and asks |

Why in the PR and not after the deploy: every deploy is a merged PR. Code and knowledge land in one commit and cannot drift apart. Nothing must run after the merge; the old rule "capture when the story is done" had no owner and was skipped for #35.

Why a check and a review: an instruction does not force an agent, a merge blocker does. The check is deterministic and catches a forgotten update. The reviewer catches an update that is wrong or incomplete.

## Parallel changes

Several story PRs are open at the same time, and all of them write the wiki and the code. Git merges line by line and stops with a conflict only when two branches change the same or adjacent lines. Human teams solved this with standard patterns; the factory uses them for every file, without special handling per asset ([AGENTS.md](../../../AGENTS.md), section "Parallel work"):

| Pattern | Rule | Examples in this repo |
|---------|------|-----------------------|
| No shared counters | Name by content, UTC time or a GitHub number, never "the next number". Two branches would take the same number and git reports nothing. | Decision records named after the decision; migrations `YYYYMMDDTHHMM_name.sql`; story records by issue number |
| One file per item | No list that every change appends to by hand | No operation log (git history and story records carry it) |
| Generated aggregates | Lists are generated; on a conflict take either side and regenerate | `index.md` from the articles' front matter (`npm run wiki:index`); `package-lock.json` (`npm install`) |
| Test the merged result | CI runs on the branch brought up to date with `main` | Strict branch protection; the release updates the branch and reruns CI |
| Real conflicts to the author | Two changes to the same code or article: merge both intents | The factory sends a conflicting PR back to the builder |

The index is generated because every story PR touched it: a date column changed in every touched row, and new rows met at the end of a table. Now each article carries its own summary and concepts in front matter; the generator sorts everything, so parallel additions land on different lines. A CI step fails when the index is stale or the front matter names an unknown concept.

## Limits

- The check sees only that the wiki changed, not what changed. Quality depends on the agent reviewer.
- Changes to the factory itself (scripts, workflows) are not app code and need no wiki change by the check; the operator documents them in `process/` and `lessons/`.

## See Also

- [Story Workflow](story-workflow.md)
- [Factory Spike Lessons](../lessons/factory-spike-lessons.md)
