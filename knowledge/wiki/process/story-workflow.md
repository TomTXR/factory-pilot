# Story Workflow

> Sources: Product owner decisions in the factory spike, 2026-11-19
> Raw: [Factory story workflow and story split](../../raw/process/2026-11-19-factory-story-workflow.md)
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
| Human Review | Approvers test the preview | Changes revise the PR; only an explicit `/approve` releases |
| Deploying, Done | Factory merges and deploys | None |
| Blocked | Human | `/retry` |
| Cancelled | Closed as not planned or duplicate, or `/cancel` | Reopen and `/start` |
| Split | The parts carry the work | None; closes with the parts |

## Story split

- If a story is too large for one pull request, the plan contains a section "Proposed split" with 2 to 5 stories in build order.
- Approving that plan creates the stories as sub-issues of the original story. Agents never create issues without this approval.
- Each part gets its own plan and plan review. The parent's plan and answers apply, so questions are not asked again.
- Parts run one after another: the next part starts when the previous part is in production.
- The parent closes when all parts are closed. Cancelling the parent cancels its open parts.
- To keep the story as one, ask for a plan without the split.

## See Also

- [Home Maintenance Log](../product/home-maintenance-log.md)
