# A waiting story is not a test bench for factory fixes

> Source: Release of story #35 on 2026-11-19 and the product owner's remark: "are you sure after that we will get #35 through? We are trying now since half a day and always running into new issues. That's exactly what a PoC is for, but I'm getting bored to be constantly stuck on this single issue"
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

What happened: #35's code was approved by the reviewer at 15:11 UTC. Its release then failed four times in a row, each time on a new factory fix being tried on it: the workflow token's branch update was held for approval (15:58); `/retry` from an outdated notice sent it to the builder (17:15); the machine account's update failed because `gh pr update-branch` needs the `repo` scope (17:35); the next fix (REST endpoint) was still untested. Meanwhile the operator's factory merges kept moving main, which put #35's PR behind again. The product owner waited about three hours for a story whose code was ready.

Decision (2026-11-19, product owner: "ok go ahead and monitor"): separate shipping the story from testing the factory.
- #35 went through the path that had already worked that day: a collaborator clicked "Update branch" on the PR (18:03, CI started normally), the reviewer approved the updated commit, the product owner got a new test request (18:07) and approved (18:16). Merged 18:17, Done 18:18; #28 closed and #46 was released from Waiting at 18:19.
- All factory merges were held until #35 was in production, so main stayed still.
- The new fixes (REST branch update, Blocked as a gate, release approval withdrawn on change requests) were merged afterwards (PRs #54 and #53) and get their first real test on the next story.

Lessons:
1. When a story is ready, ship it through a known-good path. Test new factory code on the next story, where a failure costs little.
2. Freeze factory merges while a story is in its release path; every merge can put its PR behind main.
3. Prefer least-privilege, documented APIs over convenience wrappers: the CLI's update-branch needed a broader token scope only because it reads fields it does not use.
4. Before telling a human to create a token, check what the calling code needs (the `public_repo` advice broke the first release attempt).
