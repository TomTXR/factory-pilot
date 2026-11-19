# Story Workflow

> Sources: Product owner decisions in the factory spike, 2026-11-19
> Raw: [Factory story workflow and story split](../../raw/process/2026-11-19-factory-story-workflow.md); [Human tasks and app secrets](../../raw/process/2026-11-19-human-tasks.md); [Follow-up stories from comments](../../raw/process/2026-11-19-follow-up-stories.md); [Story dependencies](../../raw/process/2026-11-19-story-dependencies.md); [Quiet notifications](../../raw/process/2026-11-19-quiet-notifications.md); [Story owners](../../raw/process/2026-11-19-story-owners.md); [Comments on human tasks](../../raw/process/2026-11-19-human-task-comments.md); [Failed CI sends a PR back](../../raw/process/2026-11-19-ci-failure-rework.md)
> Updated: 2026-11-19

## Overview

A story moves from the human's idea through an agent plan, an agent build and review, a human test on a preview, to production. Humans steer only with comments at two gates: Plan Review and Human Review. The factory manages all `factory:*` labels.

## Stages

The board columns say who acts next: columns starting with **Human:** wait for a person (Start story, Review plan, Test and release, Do task, Decide (blocked)); **Agent:** columns need no action. Filter the board with `status:"Human: Review plan"` and the other Human columns to see only your actions.


| Stage | Who acts | Human input |
|-------|----------|-------------|
| Inbox | Nobody (stories by non-approvers wait) | `/start` or `/approve` |
| Breakdown | Breakdown agent (Opus) writes the plan | None |
| Plan Review | Approvers | Answers or changes give a refined plan; `/approve` starts the build |
| In Progress, Agent Review, Rework | Builder (Sonnet) and reviewer (Opus); at most 3 rework loops. A failed CI run sends the PR back to the builder with the failing tests (the reviewer does not review red PRs). After each push to main, a factory PR that conflicts goes back to the builder to merge main (GitHub runs no checks on a conflicting PR) | None |
| Human Review | Approvers test the preview | Changes revise the PR; only an explicit `/approve` releases, and only when all human tasks are closed |
| Deploying, Done | Factory merges and deploys | None |
| Blocked | Human | `/retry` |
| Cancelled | Closed as not planned or duplicate, or `/cancel` | Reopen and `/start` |
| Waiting | Nobody: plan approved, blocked by open issues | None; starts when blockers are done; `/start` builds anyway |
| Split | The parts carry the work | None; closes with the parts |
| Human Task | A human (assigned) | Do the steps, store secrets, then close the task or comment "done"; comment a question if stuck |

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
- Comments on a task (approvers only):
  - "Done" (`/done`, or text such as "All done, secrets are stored") closes the task. Closing by hand works too.
  - A question or a problem gets an answer from an agent that reads the task, the story, the plan and the wiki. It cannot do the task and never asks for secrets.
  - If the agent cannot answer, the task moves to "Human: Decide (blocked)" and the other approvers are asked to decide.
  - A remark ("will do this tonight") gets a thumbs-up only. Story commands such as `/approve` do not apply to tasks.
- Why: anything assigned to a human can be hard, and the human needs a way to say so. Before, a comment on a task reached nobody.
- The answer agent is contained, because its prompt can hold text from a non-approver: no token in the checkout or its environment, read-only tools limited to a copy of the repository, no story text from non-approvers, and no answer that looks like a credential is posted.

## Follow-up stories

- When a plan proposes to defer work, an approver can answer in free text, for example "Yes, please create a ticket for that". The explicit request is the approval; no further step is needed.
- `/followup <what>` does the same explicitly, in any state, without changing the story's state.
- The ticket writer (Opus) writes one story per request from the story, the plan and the comment, in the template sections. Undecided points become open questions; nothing is invented.
- The factory creates the story with a link to the original story and comment, marks it as blocked by the original story, and starts its breakdown at once. Nothing is built before its plan is approved.
- Only an explicit request creates a ticket: "later" or "not now" alone does not.

## Notifications (quiet mode)

Humans get an email only when they must act. Why: GitHub emails every participant, including the issue author, about every new comment, but not about edits or reactions.

- Progress is in the **Factory status** section at the end of each story (edited in place, with a collapsed history). Read it there or on the board; it sends no email.
- A handled comment gets a reaction: thumbs up = done (see the status), eyes = the factory asked you something in a reply.
- New bot comments exist only for actions and mention the story's **owners** (see below): plan ready (part of the agent's plan comment), test request, blocked, decisions about cancelled blockers or parts. Human tasks notify by assignment.
- Info texts name people without `@`.
- The status section is display only and safe against concurrent edits (fresh read, skip if changed, verify, retry). Duplicate protection uses keys in the first line of the issues the factory creates, never the shared body.
- Set the repository watch to "Participating and @mentions" once, so agent PRs, reviews and CI send no email.

### Owners

Action notifications go to the owners of a story, not to all approvers. Any approver may still act on any story.

| Order | Owner |
|-------|-------|
| 1 | GitHub assignees who are approvers. Set one in the UI to hand a story over. The factory assigns only when an approver starts a story by a non-approver. |
| 2 | For a split part or follow-up: the approver who approved the split or asked for the follow-up (key in the issue, written by the factory) |
| 3 | The author of the story |
| 4 | All approvers |

Why: one person usually drives a story, and the list of approvers must exist only once (`FACTORY_APPROVERS`). The factory avoids assigning otherwise, because GitHub emails every assignment and most would need no action. State changes never email owners; only action comments do.

## Dependencies

- Dependencies are GitHub's native "blocked by" relations, visible on the issue and the board.
- The factory sets them for follow-ups (blocked by the original story) and split parts (each part by the previous one; part 1 inherits the parent's blockers). Humans add more in the GitHub UI.
- Planning runs at once. A story whose plan is approved while a blocker is open goes to Waiting.
- When the last blocker is completed, the build starts automatically. A blocker closed without completion keeps the story waiting; the bot asks for `/start` or `/cancel`.

## See Also

- [Home Maintenance Log](../product/home-maintenance-log.md)
- [Factory Spike Lessons](../lessons/factory-spike-lessons.md)
- [Factory Self-Hosting](factory-self-hosting.md)
