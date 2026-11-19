# Quiet notifications

> Source: Product owner request on the factory (2026-11-19): "I want to get only notifications for things I need to act on", without an email filter; repository watch set to "Participating and @mentions" is acceptable
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Problem: the product owner received an email for almost every factory step. Three causes:
1. Info messages mentioned the human ("Plan approved by @TomTXR"). A mention by the bot is a notification with reason "mention".
2. GitHub subscribes the author of an issue to every new comment on it. With watch "Participating and @mentions" the author still counts as participating, so every bot comment on his own stories sent an email (status, acks, plan, split, follow-ups, deployed). No GitHub setting turns this off only for bot comments.
3. As repository owner he watched all activity (agent PRs, reviews, CI).
At the same time, some messages that needed a human (test request, blocked, decisions) had no mention, so the other approver (Jesse) did not get them for stories he did not open.

Facts used: GitHub sends no notification for edited comments, edited issue bodies or reactions, and mentions added by an edit do not notify.

Decision (2026-11-19), "quiet mode":
- Progress goes into a status section at the end of the issue body (between `<!-- factory:status:start -->` and `<!-- factory:status:end -->`), edited in place: the current step, and a collapsed history of the last 30 steps. It also holds the factory's hidden marks (split done, tasks created, follow-ups of a comment, plan notified).
- A handled human comment gets a reaction instead of a reply: thumbs up when done (the result is in the status), eyes when the human must act again; then one reply that mentions only the commenter.
- Only messages that need a human action are new comments, and they always mention the approvers: plan ready, test request, blocked (reviewer inconclusive, rework limit, release failed, deploy failed), a blocker or split part closed without completion. Human tasks notify through the assignment.
- Names in info texts are written without `@`.
- The breakdown agent ends its plan comment with the review request and the approvers' mentions, so a plan is one comment and one email. The factory posts the old separate notice only if a mention is missing (for example a new approver added only in `FACTORY_APPROVERS`; the agent's list is in its `config.json`).
- The rework reason goes on the pull request (agent PRs do not notify humans), not on the issue, except when no PR is open and the builder must read it from the issue.
- Each approver sets the repository watch to "Participating and @mentions" once, so agent PRs, reviews and CI do not send email.

Review finding (2026-11-19, PR #40): the issue body is shared by several workflows and by humans, so a plain read-modify-write can lose updates. Therefore:
- Status writes rebuild from a fresh read, skip the write when the issue changed meanwhile (another step or a human edit), verify their line afterwards and retry up to 5 times. The status section is display only.
- Duplicate protection never relies on the body: created issues carry a first-line key (split part, human task, follow-up), and a rerun reuses what it finds by that key.

Expected result per story: the plan (with review request), the test request, human-task assignments, and messages for blocked steps or decisions. Story #20 had 9 bot and agent comments, which under quiet mode would have been 3 emails.
