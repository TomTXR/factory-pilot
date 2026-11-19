# Release: bring the PR up to date like a human would

> Source: Release of story #35 (PR #45) on 2026-11-19 and the product owner's questions: "we need to do better coordination to synchronize reviewing and merging PRs"; "this fixes would still use standard flows, right? I do not want to overengineer that"; "if our agents would have been humans, would there have been the same issue? if not why not?"
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

What happened: the product owner released #35 with `/approve` at 15:29 UTC. Branch protection requires a PR to be up to date with main before merge. The operator had merged three factory PRs (#47 to #49) between 15:09 and 15:26, so PR #45 was behind. The release workflow brought it up to date with `gh pr update-branch` using the workflow token. GitHub treated that merge commit like a commit by an outside contributor (repository setting: approval for all external contributors) and held its CI runs with `action_required`. The release waited 25 minutes for checks that never started, then blocked #35. `/retry` could not help: on a blocked story with an open PR it sends the PR back to the builder.

First proposal (dropped): a custom merge lane that queues all merges, including the operator's factory PRs. GitHub's merge queue needs an organization-owned repository.

The product owner's question changed the design: would humans have had the same problem? The situation, yes: a colleague merging while your PR waits for testing is normal. The problem, no: a human clicks "Update branch" as a collaborator, CI starts, they wait for green and merge; if someone merged in between they click again. A human also sees "Approve workflows to run" at once. The only real difference was the identity of the update.

Decision (2026-11-19, product owner: "that sounds much better, keep things simple"): the release does what a human does, with standard GitHub flows, no custom queue.
- The branch update runs as the machine account `domigo-factory-bot` (repository secret `FACTORY_BOT_TOKEN`, a classic token with `public_repo`, created by the product owner as a human task; fine-grained tokens cannot reach another user's repository). Its CI starts like a collaborator's.
- If main moves again during the release, it updates again (at most 3 times).
- It blocks at once when CI runs wait for approval, and within 3 minutes when the required checks (`checks`, `e2e`) do not start, naming the reason. No silent waiting.
- A blocked release records `release-blocked <pr> <head>` in the story; a new explicit `/approve` retries exactly that release. `/retry` keeps its meaning (back to the agents).
- While a story is being released, the release's own branch update does not move it back to Agent Review, does not post a second test request, and a review verdict changes nothing.
- Releases stay serialized per story by the standard Actions concurrency setting. Courtesy rule for the operator: no factory merges while a story is in "Agent: Deploying".

Follow-up bug (PR #51): the `status` subcommand dropped its third argument, so the release mark was never written. The first test checked only the workflow text; the new one checks the effect. Lesson: test the effect, not the wiring.
