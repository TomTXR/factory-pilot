# Story Workflow

> Sources: Product owner decisions in the factory spike, 2026-11-19
> Raw: [Factory story workflow and story split](../../raw/process/2026-11-19-factory-story-workflow.md); [Human tasks and app secrets](../../raw/process/2026-11-19-human-tasks.md); [Follow-up stories from comments](../../raw/process/2026-11-19-follow-up-stories.md); [Story dependencies](../../raw/process/2026-11-19-story-dependencies.md)
> Updated: 2026-11-19

## Overview

A story moves from the human's idea through an agent plan, an agent build and review, a human test on a preview, to production. Humans steer only with comments at two gates: Plan Review and Human Review. The factory manages all `factory:*` labels.

## Stages

| Stage | Who acts | Human input |
|-------|----------|-------------|
| Inbox | Nobody (stories by non-approvers wait) | `/start` or `/approve` |
| Breakdown | Breakdown agent (Opus) writes the plan | None |
| Plan Review | Approvers | Answers or changes give a refined plan; `/approve` starts the build |
| In Progress, Agent Review, Rework | Builder (Sonnet) and reviewer (Opus); at most 3 rework loops | None |
| Human Review | Approvers test the preview | Changes revise the PR; only an explicit `/approve` releases, and only when all human tasks are closed |
| Deploying, Done | Factory merges and deploys | None |
| Blocked | Human | `/retry` |
| Cancelled | Closed as not planned or duplicate, or `/cancel` | Reopen and `/start` |
| Waiting | Nobody: plan approved, blocked by open issues | None; starts when blockers are done; `/start` builds anyway |
| Split | The parts carry the work | None; closes with the parts |
| Human Task | A human (assigned) | Do the steps, store secrets, close the task |

## Story split

- If a story is too large for one pull request, the plan contains a section "Proposed split" with 2 to 5 stories in build order.
- Approving that plan creates the stories as sub-issues of the original story. Agents never create issues without this approval.
- Each part gets its own plan and plan review. The parent's plan and answers apply, so questions are not asked again.
- Parts run one after another: the next part starts when the previous part is in production.
- The parent closes when all parts are closed. Cancelling the parent cancels its open parts.
- To keep the story as one, ask for a plan without the split.

## Human tasks

- Work only a human can do (accounts, external consoles such as Google Cloud, credentials, DNS) is planned as a human task in the plan section "Human tasks".
- Approving the plan creates each task as a sub-issue labelled `factory:human-task`, assigned to the approver. The build starts at once; the release waits until all tasks are closed.
- Secret values never go into issues or comments (public repository). They are stored as repository secrets named `PILOT_<NAME>`; production receives them on the next deploy, previews and CI never do.
- The app works without the secrets where possible (labelled test path) or fails with a clear log line.
- Cancelling a story closes its open tasks. In a split, each part lists its own tasks.

## Follow-up stories

- When a plan proposes to defer work, an approver can answer in free text, for example "Yes, please create a ticket for that". The explicit request is the approval; no further step is needed.
- `/followup <what>` does the same explicitly, in any state, without changing the story's state.
- The ticket writer (Opus) writes one story per request from the story, the plan and the comment, in the template sections. Undecided points become open questions; nothing is invented.
- The factory creates the story with a link to the original story and comment, marks it as blocked by the original story, and starts its breakdown at once. Nothing is built before its plan is approved.
- Only an explicit request creates a ticket: "later" or "not now" alone does not.

## Dependencies

- Dependencies are GitHub's native "blocked by" relations, visible on the issue and the board.
- The factory sets them for follow-ups (blocked by the original story) and split parts (each part by the previous one; part 1 inherits the parent's blockers). Humans add more in the GitHub UI.
- Planning runs at once. A story whose plan is approved while a blocker is open goes to Waiting.
- When the last blocker is completed, the build starts automatically. A blocker closed without completion keeps the story waiting; the bot asks for `/start` or `/cancel`.

## See Also

- [Home Maintenance Log](../product/home-maintenance-log.md)
- [Factory Spike Lessons](../lessons/factory-spike-lessons.md)
