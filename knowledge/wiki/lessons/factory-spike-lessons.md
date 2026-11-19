# Factory Spike Lessons

> Sources: Spike 0 log and decisions, 2026-11-17 to 2026-11-19; product owner decisions on stories #25, #28, #32
> Raw: [Project knowledge duty](../../raw/process/2026-11-19-project-knowledge-duty.md); [Story as test bench](../../raw/lessons/2026-11-19-story-as-test-bench.md); [Blocked as a gate](../../raw/process/2026-11-19-blocked-as-gate.md); [Release branch update](../../raw/process/2026-11-19-release-branch-update.md); [Silent stalls and the watchdog](../../raw/process/2026-11-19-silent-stalls-watchdog.md); [Plan criterion for non-existing data](../../raw/lessons/2026-11-19-plan-criteria-for-nonexistent-data.md); [Factory spike lessons](../../raw/lessons/2026-11-19-factory-spike-lessons.md); [Quiet notifications](../../raw/process/2026-11-19-quiet-notifications.md); [Story owners](../../raw/process/2026-11-19-story-owners.md); [Board column names](../../raw/lessons/2026-11-19-board-column-names.md); [Story dependencies](../../raw/process/2026-11-19-story-dependencies.md)
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
| The agent's mentions were a hardcoded copy of the approver list; every approver got every story | Story owners: assignee, else the factory's owner key, else the author, else all approvers. One approver list; no assignment emails without a hand-over |

## Story shape

| Problem seen | Change |
|--------------|--------|
| A story was too large for one PR (#28) | The plan proposes a split; approval creates sub-issues built one after another |
| External setup (Google OAuth client) was only a plan risk (#28) | Human tasks as assigned sub-issues; the release waits for them |
| A comment on a human task reached nobody; "All done" did not close it, `/approve` would have planned the task (#38) | Task comments: done closes, a question gets an agent answer, else the task is blocked and the other approvers decide |
| No safe place for credentials in a public repo | Repository secrets `PILOT_<NAME>`, production only, never in comments |
| Deferred work had to be typed by hand (#28 question 2) | "Please create a ticket" or `/followup`: the factory writes and starts the story |
| A follow-up could be built before what it needs (#32 needs #28) | GitHub "blocked by"; planning runs, the build waits until blockers are done |

## Plan review

| Problem seen | Change |
|--------------|--------|
| #35's plan claimed unowned properties for the first account to sign in, although production had none. The rule collided with per-account uniqueness and 30-day sessions: 2 reworks, each fix revealing the next edge case (P0 lockout, P1 data exposure) | Criterion dropped by `/changes`. At plan review, reject criteria for scenarios that cannot occur; list them under Out of scope. When review findings keep hitting the same rule, the rule is wrong, not the code: send the story back to the human (not built yet) |

## Silent stalls

| Problem seen | Change |
|--------------|--------|
| The reviewer skipped a red PR (#34), the release waited for held CI (#35), the builder refused without telling anyone (#46). Each time the human noticed, after 30 minutes to 2.5 hours | A watchdog blocks agent steps that make no progress within their limit and tells the owner. General rule: every waiting loop needs a timeout with a stated reason, and every agent that stops says why |
| The release updated a PR as the workflow token; GitHub held its CI like an outside contributor's (#35) | Do what a human would: update as the machine account (a collaborator). Ask "would a human have had this problem?" before building machinery: here it led to a fix with standard flows instead of a custom merge queue |
| A plan named a dependency and asked the human to set it in the GitHub UI (#46) | Plans list dependencies in a section the factory executes. Plans never ask for manual GitHub changes |
| A fix wrote a mark through a subcommand that dropped the argument; the test checked only the workflow text (PR #51) | Test the effect, not the wiring |
| #35's approved code waited about three hours while four new factory fixes were tried on its release, each failing on a new edge case; factory merges kept putting its PR behind main | Ship a ready story through a known-good path (a collaborator's "Update branch", review, `/approve`); hold factory merges during a release; test new factory code on the next story. Use least-privilege documented APIs (the CLI's update-branch needed `repo` scope for fields it does not use) |
| The human followed an old block notice (`/retry`) while the operator's correction (`/approve`) existed only in the chat; `/retry` sent an approved release back to the builder, which found nothing to change (#35) | Blocked is a gate with free text; the factory maps "go on" to the action by the block reason. One rule for humans: exact commands only for the production decision. Corrections always go into the issue |

## Project knowledge

| Problem seen | Change |
|--------------|--------|
| Agents documented product answers but not the code structure or technical decisions; #35 had no story record because "capture when done" ran after the merge, with no owner and no check | The story's own PR updates the wiki (concept articles, decision records, concept map) and adds the story record. A required CI check fails without it; the agent reviewer checks the content. Every agent reads the whole index first and picks the relevant articles itself ([Project Knowledge](../process/project-knowledge.md)). Rule: a duty without an owner and a merge blocker does not happen |

## Agents and quality

- Plans decide quality: breakdown and review run on Opus, code on Sonnet, all at effort medium.
- Agents act as a machine account, never as a human. Reviews and factory markers count only from that account or the automation; forged approvals were a P0.
- The reviewer agent found a real defect in almost every factory change. Example: the first agent with file tools in a comment workflow could have been tricked into posting a token (PR #42); every such agent now runs without tokens, in a copy without `.git`. Every change goes through it, with a test that fails without the fix.
- Merge conflicts on factory branches go back to the builder automatically.

## GitHub specifics

- Actions by `GITHUB_TOKEN` trigger no workflows: follow-up steps run inline.
- Closing keywords do not apply to merges by `GITHUB_TOKEN`: the factory closes the issue itself.
- Rebase merge fails on branches with merge commits: squash merge, branch update by merge.
- Changing the board's status options resets all cards: save and restore the statuses.
- Each workflow step has its own `GITHUB_OUTPUT` file.
- The reviewer template does not review a PR with red required checks and says nothing. A failed CI run on a factory PR must go back to the builder, or the story waits forever (#34, PR #39).
- jq's `//` treats `false` as missing: `.mergeable // empty` never reports a conflict.
- `gh pr comment --edit-last` edits the newest comment of the account, not a specific one. All factory comments share one account, so it overwrote a rework request and reset the rework count (PR #45). Update comments only by their own marker ([source](../../raw/process/2026-11-19-preview-comment-edit-last.md)).
- GitHub runs no `pull_request` workflows on a PR with a merge conflict, and `mergeable` is `null` until computed. Conflicts must be checked on `push` (main and factory branches), polling until GitHub reports true or false.

## See Also

- [Story Workflow](../process/story-workflow.md)
- [Factory Self-Hosting](../process/factory-self-hosting.md)
- [Project Knowledge](../process/project-knowledge.md)
