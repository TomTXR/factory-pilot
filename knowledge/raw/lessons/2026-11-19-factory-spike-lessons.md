# Factory spike lessons (2026-11-17 to 2026-11-19)

> Source: Spike 0 log and decisions of the software factory spike (DomiGO docs `docs/engineering/software-factory/spike-0-log.md`, findings F1-F51, decisions D1-D26), and the product owner's request to record the tweaks as the main learnings
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Tweaks made while running real stories (#7, #13, #18, #20, #25, #28, #32) through the factory, with the trigger for each:

1. Labels as the human interface were error-prone (the product owner could not remember the workflow). Replaced by comment commands (/approve, /changes, /retry, /cancel, /start, /followup) and intent inference from plain text at the two gates; labels became factory-managed state.
2. Plain text never releases to production: the release needs an explicit /approve. Cancel inferred from text only asks for /cancel.
3. The classifier treats answers that accept all proposed defaults as an approval. On #28 this approved an old plan the human wanted refined (2026-11-19); the state was reset by hand before the builder started. New plans carry machine-readable sections, so approval does the right thing.
4. Agents acted as the human's GitHub account. A machine account (domigo-factory-bot) now does agent work; reviews and markers only count from that account or the automation (forged approvals were a P0 found in review).
5. Closed stories stayed in Plan Review (#25). Closing as not planned or duplicate, or /cancel, now cancels: PRs closed, previews removed; late agent PRs on a cancelled story are closed.
6. A story too large for one PR (#28): the plan proposes a split in a marked section; approval creates sub-issues, built one after another; the parent closes with its parts.
7. Work only a human can do (#28: Google OAuth client) appeared only as a plan risk. Now: human tasks as assigned sub-issues; the release waits for them. Secret values never go into the public issue tracker: repository secrets PILOT_<NAME>, passed only to production by the deploy, single-quoted in the server env file.
8. Deferred work (#28 question 2): "please create a ticket" in free text, or /followup, makes the factory write and create the story from the plan and start its breakdown; the request is the approval.
9. Dependencies (#32 needs #28): GitHub "blocked by"; planning runs, the build waits (Waiting) and starts when blockers are done.
10. Plans matter most: breakdown and review run on Opus, code on Sonnet, all at effort medium.
11. The reviewer agent found a real defect in almost every factory change (forged approvals, close order with split parents, follow-up failures blocking a comment). Every factory change goes through it, with a test that fails without the fix.
12. GitHub specifics: actions by GITHUB_TOKEN trigger no workflows, so follow-up steps run inline; closing keywords do not apply to merges by GITHUB_TOKEN; rebase merge fails on branches with merge commits (squash merge, branch update by merge); changing the board's status options resets all cards (save and restore); each step has its own GITHUB_OUTPUT file.
13. Merge conflicts on factory branches go back to the builder automatically; /retry continues a blocked story.
