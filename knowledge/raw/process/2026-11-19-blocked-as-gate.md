# Blocked is a gate: free text, the factory chooses the action

> Source: Story #35 on 2026-11-19 and the product owner's remarks: "I typed retry because the last comment said 'Decide, then reply /retry'"; "instead of making things complicated: I thought we said exact commands are only necessary for the deploy step, otherwise we guess the intent from what was written. So if I typed retry or approved or whatever it should work as long as the intent is clear"; "the design is right but is it implemented like that? apparently not, so build it now"
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

What happened: #35's release was blocked at 15:58 UTC by the old release workflow, whose notice said "reply /retry". After the fix (PRs #50, #51) the operator told the product owner in the chat to use `/approve`, and wrote it only into the issue's status section, which sends no email. The product owner followed the last notification and replied `/retry` at 17:15. `/retry` sent the PR to the builder; the builder correctly found nothing to change and stopped; #35 sat in Agent: Reworking. The operator put it back into the blocked release by hand at 17:29.

Root causes:
1. Blocked was not a gate. It read only exact commands with one fixed meaning each (`/retry` = back to the agents, `/approve` = retry a blocked release). The human had to know why the factory was blocked to pick the right command. This contradicted the rule from 2026-11-18: exact commands only for the production decision, free text everywhere else.
2. A correction existed only in the chat with the operator. The human should only ever need the issue.
3. A rework without code change had no next step (AGENTS.md rule 13 covered "I won't build", not "nothing to change").

First proposal (dropped): better hint texts per block reason. The product owner rejected it as complicated.

Decision (2026-11-19, product owner): Blocked is a gate like Plan Review and Human Review. The intent classifier reads the comment (blocked mode: continuing as is, "go on", "retry", "approve", counts as approve). The factory acts by the block reason it recorded:
- blocked release (mark `release-blocked <pr> <head>` matches the PR head): release the same commit again. This is not a new release decision: the human approved exactly this commit with an explicit `/approve` at Human Review. A new commit always needs a new test request and an explicit `/approve`.
- Any change request after that (by the human, the reviewer agent, failing CI or a conflict) withdraws the approval: the factory records `release-cleared <pr> <head>`, and the latest mark for the head decides. Found by the reviewer agent (P0 on PR #53): without it, "go on" after a change request and a stalled builder would have released the commit the human had asked to change.
- planning stalled: plan again (never build an unapproved plan).
- anything else (stall, agent stop, rework limit, no verdict): the agents continue and read the thread.
- a change request: the agents revise with it, whatever the reason; it never releases.
- unclear: the factory asks how to continue. Cancelling still needs the exact `/cancel`.
No human decision is needed for two cases: failing checks at release go straight to the builder (like conflicts), and a builder that finds nothing to change blocks with a comment; if only the release is missing, the notice says "go on" releases it.
Notices now say "reply how to continue (for example 'go on')" instead of naming commands.

Verified: real classifier on blocked comments: "retry", "Approved", "ok go on" -> approve; "the delete button must be red first" -> changes; "what happened here?" -> unclear.

Lessons: keep one rule for humans (free text except the production decision) and let the factory map intent to action by context. Never leave a correction only outside the issue.
