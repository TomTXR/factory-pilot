# Story owners

> Source: Product owner questions on quiet mode (2026-11-19): the breakdown agent's mentions were a hardcoded copy of the approver list; should only the originator be notified, and how does that work for factory-created issues; would assignees get emails for every state change
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Problem: the breakdown agent mentioned a hardcoded list (TomTXR, AxemanNL) from its config, a second copy of the repository variable FACTORY_APPROVERS. The lists drift apart (a new approver would only get the fallback notice, two emails per plan). Also, all approvers were notified for every story, although usually one person drives it.

Decision (2026-11-19): action notifications (plan ready, test request, blocked, decisions) go to the story's owners. Any approver may still act on any story; only the notification is narrower.

Owner rule, first match wins, only approvers count:
1. The GitHub assignees. A human sets them to hand a story over; the factory sets one only when an approver starts a story opened by a non-approver (a real take-over).
2. The owner key `<!-- factory:owner <login> -->` in the first lines of an issue the factory created (split part: the approver who approved the split; follow-up: the approver who asked for it). Only trusted in issues authored by the factory.
3. The author of the story.
4. All approvers (nobody is missed).

Why not always set the assignee: GitHub emails every assignment. Assigning the originator of each story, each split part and each follow-up would send emails that need no action (part 2 of a split waits for days). State changes themselves (labels, board, body edits) send no email to assignees or authors; only new comments do, and in quiet mode those exist only for actions.

The breakdown agent computes the same rule from the issue data (no list in its config). The factory checks that every owner is mentioned in the plan and posts a fallback notice if not. Human tasks are still assigned, because they are actions.
