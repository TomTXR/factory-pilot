# Factory Spike Lessons

> Sources: Spike 0 log and decisions, 2026-11-17 to 2026-11-19; product owner decisions on stories #25, #28, #32
> Raw: [Factory spike lessons](../../raw/lessons/2026-11-19-factory-spike-lessons.md); [Quiet notifications](../../raw/process/2026-11-19-quiet-notifications.md); [Board column names](../../raw/lessons/2026-11-19-board-column-names.md); [Story dependencies](../../raw/process/2026-11-19-story-dependencies.md)
> Updated: 2026-11-19

## Overview

Running real stories through the factory showed where the first design broke. Each tweak below came from a concrete story. The current rules are in [Story Workflow](../process/story-workflow.md); this article records why they exist.

## Human interface

| Problem seen | Change |
|--------------|--------|
| Labels as controls were error-prone; the human could not remember the flow | Comment commands and plain-text intent at the two gates; labels are factory state only |
| A guessed intent must not ship code | Only an explicit `/approve` releases; an inferred cancel only asks for `/cancel` |
| Answers that accept all defaults count as approval (#28 approved an old plan by surprise) | Plans carry machine-readable sections, so approval does the right thing; check the plan-ready notice before answering |
| Closed stories stayed in Plan Review (#25) | Close as not planned or duplicate, or `/cancel`, cancels the story and its PRs and previews |
| Board columns named states, not who acts; humans could not see where they were needed | Columns start with `Human:` or `Agent:` (for example "Human: Review plan", "Agent: Building"); filter on the Human columns |
| An email for almost every factory step; some action messages reached nobody but the author | Quiet mode: progress in an edited status section, reactions instead of replies, new comments only for actions and always with the approvers' mentions; the plan carries its own review request. Reason: GitHub notifies participants about new comments, not about edits or reactions |

## Story shape

| Problem seen | Change |
|--------------|--------|
| A story was too large for one PR (#28) | The plan proposes a split; approval creates sub-issues built one after another |
| External setup (Google OAuth client) was only a plan risk (#28) | Human tasks as assigned sub-issues; the release waits for them |
| No safe place for credentials in a public repo | Repository secrets `PILOT_<NAME>`, production only, never in comments |
| Deferred work had to be typed by hand (#28 question 2) | "Please create a ticket" or `/followup`: the factory writes and starts the story |
| A follow-up could be built before what it needs (#32 needs #28) | GitHub "blocked by"; planning runs, the build waits until blockers are done |

## Agents and quality

- Plans decide quality: breakdown and review run on Opus, code on Sonnet, all at effort medium.
- Agents act as a machine account, never as a human. Reviews and factory markers count only from that account or the automation; forged approvals were a P0.
- The reviewer agent found a real defect in almost every factory change. Every change goes through it, with a test that fails without the fix.
- Merge conflicts on factory branches go back to the builder automatically.

## GitHub specifics

- Actions by `GITHUB_TOKEN` trigger no workflows: follow-up steps run inline.
- Closing keywords do not apply to merges by `GITHUB_TOKEN`: the factory closes the issue itself.
- Rebase merge fails on branches with merge commits: squash merge, branch update by merge.
- Changing the board's status options resets all cards: save and restore the statuses.
- Each workflow step has its own `GITHUB_OUTPUT` file.

## See Also

- [Story Workflow](../process/story-workflow.md)
