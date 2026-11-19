# Factory Self-Hosting

> Sources: Product owner question in the factory spike session, 2026-11-19
> Raw: [Idea: the factory develops itself](../../raw/process/2026-11-19-factory-self-hosting-idea.md); [Idea: a software factory hub](../../raw/process/2026-11-19-software-factory-hub-idea.md); [Idea: publish the learnings as a guide](../../raw/process/2026-11-19-publish-as-guide-idea.md); [Silent stalls and the watchdog](../../raw/process/2026-11-19-silent-stalls-watchdog.md)
> Updated: 2026-11-19

## Overview

Status: **idea, not decided, not planned.** The software factory could develop itself: a change to the factory is a story like any other, planned, built, reviewed and released through the factory. The answer to "could we, and would we want to" is yes to both, at some point after the spike.

## Why it fits

- Factory changes in the spike already had a story's lifecycle: problem, plan, code, tests, agent review, merge, wiki notes (PRs #42 to #47).
- Work outside the repository (VM, automation bundles, repository settings) maps to human tasks.
- The reviewer agent already reviews factory PRs and finds real defects.
- Benefit: factory changes get the same discipline as app changes, independent of the operator, and the factory learns from its own failures.

## What needs care

| Concern | Safeguard |
|---------|-----------|
| Lockout: a broken change breaks the factory that must repair it | Manual escape route (direct push and merge by a human) and a pinned known-good version |
| Self-granted rights: agents widen their own permissions through workflows | Workflow and permission changes need an explicit human `/approve`; the builder cannot push `.github/workflows` (not verified) |
| No preview for factory changes | Test step is a run against a separate test repository |
| Stalls are noticed by humans, not the factory | A watchdog blocks stuck stories and tells the owner (built 2026-11-19 after #34, #35 and #46 stalled silently) |

## Software factory hub

The factory is a product of its own, outside DomiGO. Its knowledge should have one entry point (idea, eventually). Today it sits in three places: this pilot wiki, the DomiGO docs (`docs/engineering/software-factory/`: concept and decisions, spike log, lifecycle recipe), and the factory VM (automation bundles, configuration, only partly written down). The separate factory repository would host the hub as its wiki; DomiGO would link to it and keep only its app knowledge.

The learnings could eventually be published as a guide for others who build a software factory (idea): the hub is the source, the guide its curated public edition, without credentials, internal hosts or personal data.

## Suggested order

1. After the spike: a separate, app-agnostic factory repository with the software factory hub as its wiki; a pinned stable version serves the DomiGO repository.
2. First self-hosted story: to be chosen (the watchdog, first planned here, was built directly on 2026-11-19).

## See Also

- [Story Workflow](story-workflow.md)
- [Factory Spike Lessons](../lessons/factory-spike-lessons.md)
