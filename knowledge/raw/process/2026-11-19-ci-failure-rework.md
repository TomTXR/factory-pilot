# Failed CI sends a factory PR back to the builder

> Source: Product owner question (2026-11-19): "are we good on #34? the agent review seems to go on forever"
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Problem: the builder pushed PR #39 for story #34 at 10:50 UTC. One e2e test failed on desktop and mobile ("a failed Google sign-in message shows on the login screen": the alert never appeared). The reviewer agent (OpenHands template github-pr-reviewer) does not review a head whose required checks are red. It skipped the PR every 5 minutes without a message. The factory sent work back to the builder only for a review verdict or for a conflict at release, so nobody acted. The story showed "Agent: Reviewing" for more than 2.5 hours while no agent worked on it. The PR also started to conflict with main, because 4 factory PRs were merged meanwhile.

Decision (2026-11-19, product owner approved): a failed CI run on a factory PR is a rework.
- Workflow `factory-ci-failed.yml` listens for completed CI runs (`workflow_run`). On failure of a `pull_request` run on a `factory/issue-*` branch it calls `factory-flow.sh ci-failed <pr> <run> <sha>`.
- The handler sends the PR back to the builder through the normal rework path: a rework comment on the PR with the failed job names and the error lines from the log (test names, assertion messages), and the review status `failure`, which makes the builder revise the PR.
- If the PR also conflicts with main, the same comment tells the builder to merge main and keep both main's features and the story working.
- It counts toward the limit of 3 reworks, so a test the builder cannot fix ends in "Human: Decide (blocked)" instead of a loop.
- Only for stories in a build state (planned, building, reviewing, reworking); only for the PR's current head; only once per head.

Bug found by the tests: jq's `//` operator treats `false` as missing, so `.mergeable // empty` never reported a conflict. The check now compares `.mergeable` directly.

Why not let the reviewer agent review red heads: the template gate is deliberate (it never approves a red head), and a review of a red head would only repeat the CI result. The builder needs the failure, not a review.
