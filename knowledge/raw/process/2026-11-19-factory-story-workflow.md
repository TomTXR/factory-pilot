# Factory story workflow and story split

> Source: Product owner decisions in the factory spike (issues #25 and #28), implemented in `.github/scripts/factory-flow.sh` and the breakdown automation
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Stories flow through the factory as follows. A human creates a story (issue template "User story"). If the author is an approver, the breakdown starts automatically. Otherwise it waits in the inbox until an approver comments `/approve` or `/start`.

The breakdown agent (Claude Opus, effort medium) posts one plan comment: summary, acceptance criteria, out of scope, technical notes, context used, open questions. Approvers then answer in comments. Answers or change requests produce a refined plan. `/approve`, or a clear plain-text approval, starts the build.

The builder agent (Claude Sonnet, effort medium) opens a pull request. The reviewer agent (Claude Opus, effort medium) reviews it. Requested changes go back to the builder, at most 3 rework loops. After the agent approves and the preview is healthy, the approvers get a test request with the preview link. Only an explicit `/approve` merges and releases to production.

Labels `factory:*` are managed by the factory. Humans never set them.

Closing a story as "not planned" or "duplicate", or the comment `/cancel`, cancels it. Open pull requests are closed and previews removed. Reopening puts the story back in the inbox (`/start` to begin again).

Story split (decided 2026-11-19 on story #28, "Protect the app with login"): the breakdown agent judged the story too large for one pull request and proposed two stories. The product owner decided that an approved split must create the stories automatically. Agents must not create issues on their own.

How it works:
- If a story is too large, the breakdown agent adds a section "Proposed split" with the marker `<!-- factory:split -->`. The section contains 2 to 5 stories in build order. Each story has a title, the story, complete acceptance criteria and out of scope.
- The plan-ready notice says that approving splits the story.
- When an approver approves that plan, the factory creates each proposed story as a GitHub sub-issue of the original story. The original story gets the state `factory:split` and the board status "Split".
- Each part gets its own breakdown and plan review. The breakdown agent reads the parent issue for the full plan and the answers already given.
- Parts are built one after another. The first part starts at once. The next part starts when the previous part is deployed to production.
- The parent closes as completed when all parts are closed and at least one part is completed. It closes as not planned when all parts were cancelled.
- Cancelling the parent cancels its open parts.
- To keep a large story as one, ask for a plan without the split instead of approving.
