# Story dependencies

> Source: Product owner question on follow-up story #32 (household sharing), which depends on #28 (login); implemented in `.github/scripts/factory-flow.sh`
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Problem: #32 was created as a follow-up of #28 and needs the accounts from #28. Nothing stopped an approver from approving #32 first; the builder would then have built sharing on code without login, duplicating or conflicting with #28.

Decision (2026-11-19): dependencies use GitHub's native issue relation "blocked by". Planning runs at once; only the build waits.

How it works:
- The factory sets the relation automatically: a follow-up story is blocked by the story it came from; part k of a split is blocked by part k-1; part 1 inherits the open blockers of its parent. Humans add more in the GitHub UI ("Mark as blocked by").
- When a plan is approved while a blocker is open, the story goes to `factory:waiting` (board column Waiting) and the bot names the blockers. The builder does not start.
- When a story closes, the factory checks the stories it blocks. A waiting story whose blockers are all completed goes to the builder automatically. If a blocker was closed without being completed, the story keeps waiting and the bot asks: `/start` to build anyway, `/cancel` to drop it.
- `/start` (or `/approve`) on a waiting story builds it at once despite open blockers.
- A split parent closes only after all its parts, so "blocked by the parent" covers all parts.
- #32 was marked as blocked by #28 on 2026-11-19.
