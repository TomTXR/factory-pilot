# Silent stalls and the watchdog

> Source: Story #46 ("delete user account") on 2026-11-19, the product owner's questions "please find the root cause" and "how do we prevent this from happening again?", and the incidents on #34 and #35 the same day
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

What happened on #46: the plan said the story needs #35 (per-account properties) and the product owner confirmed that it waits for #35. The plan then asked "an approver adds 'blocked by #35' on this issue in the GitHub UI". The factory set dependencies automatically only for split parts and follow-ups, so the dependency stayed in prose. The product owner's `/approve` at 15:31 UTC started the build at once. The builder saw at 15:35 that #35 was not merged and correctly built nothing, but it wrote its reason only into its own conversation log on the factory VM: no comment on the issue, no state change. The story showed "Agent: Building" for more than an hour. The product owner noticed it.

Root cause: two gaps in a row.
1. A dependency in a normal plan was a manual step for the human, against the rule "no manual handling", and buried in the plan text.
2. An agent that decides not to act had no way to say so to the factory. For the agent the job was done; for the factory the story was still building.

The common pattern of the day: #34 (the reviewer skips a PR with red CI), #35 (the release waited for CI runs that were held) and #46 (the builder refused silently) all stalled without anyone being told. Each time the product owner noticed, after 30 minutes to 2.5 hours. The factory assumes each step produces the next event; when an agent or GitHub produces nothing, nobody notices.

Decision (2026-11-19, product owner): prevention on three levels.
1. Close the known causes:
   - Plans list dependencies in a section `## Dependencies` (first line `<!-- factory:depends-on -->`, bullets `- #<n>: <why>`). On `/approve` the factory sets GitHub "blocked by" relations, before a split, so parts inherit them; the story then waits and builds when the blockers are done.
   - The breakdown agent may never ask a human to change anything in GitHub by hand (labels, relations, settings); everything goes into plan sections the factory executes.
   - AGENTS.md rule 13: an agent that does not build comments why on the issue and sets `factory:blocked`. The factory (job `agent-blocked`) makes it a proper block and notifies the story's owner with a link to the reason.
2. A watchdog for unknown causes: a scheduled workflow every 15 minutes. A story whose agent step made no progress within its limit is blocked once per entry into the state, and its owners are told which step stalled. Progress means the factory state label changed, because every agent step ends by changing it. Limits: Planning 30 min, Building 60, Reviewing 60, Reworking 60, Deploying 45. Human and waiting states are never flagged. A stalled release can be retried with `/approve`, other steps with `/retry`.
3. No manual steps in plans (see 1).

#46 was corrected by hand: blocked by #35 and moved to Waiting; its build starts when #35 is done.
