# factory-pilot

Throwaway pilot app for the DomiGO software factory spike: a small "Home Maintenance Log" web app that the factory extends through user stories.

- Production: https://pilot.domigo.com (deployed on every merge to `main`)
- Previews: https://pilot-pr-<n>.domigo.com (one per open PR)

Start here: [AGENTS.md](AGENTS.md) (architecture, commands, rules).

```bash
npm run setup
npm run up      # http://localhost:8080
npm run e2e
```

Deployment: `.github/workflows/deploy.yml` calls `deploy/server/pilot-deploy.sh` on the factory VM over SSH after CI passes.

## Working with the factory (humans)

On the board, columns starting with **Human:** wait for you; **Agent:** columns need nothing from you.

**Notifications:** set this repository's Watch to "Participating and @mentions". The factory then emails you only when you must act (plan ready, test request, blocked, decisions, assigned human tasks). These go to the story's owner: the assignee if set, else the approver who triggered a factory-created story, else the author. Assign someone else to hand a story over. Progress is in the **Factory status** section at the end of each story and on the board; a thumbs-up reaction on your comment means it was handled.

1. **New story:** GitHub -> Issues -> New issue -> "User story". The breakdown starts automatically.
2. **Plan ready** (you get a notification): read the plan, then reply in a comment. Answers or change requests lead to a refined plan; `/approve` (or a clear "looks good, go ahead") starts the build.
3. **Test request** (you get a notification with the test link): test on the preview, then reply. A description of what is wrong (or `/changes <what>`) makes the builder revise the PR; **only an explicit `/approve` releases to production**.
4. **Blocked:** read the bot's explanation, then `/retry` (optionally with instructions).
5. **Large story:** the plan may propose a split. Approving that plan creates the parts as sub-issues; each part gets its own plan and they are built one after another. The original story closes when all parts are closed. See `knowledge/wiki/process/story-workflow.md`.
6. **Human tasks** (you get an assignment): work only a human can do, such as an OAuth client in Google Cloud or an API key. Follow the steps in the task, store secret values only as repository secrets named `PILOT_<NAME>` (Settings, Secrets and variables, Actions; never in a comment), then close the task, or comment `/done` or "All done". Stuck? Comment your question: an agent answers from the plan and the wiki, and if it cannot, the other approvers are asked. Production gets these secrets on the next deploy. The release `/approve` waits until all tasks of the story are closed.
7. **Follow-up tickets:** when a plan proposes to defer something, answer for example "yes, please create a ticket for that" (or `/followup <what>`, in any state). The factory writes the story from the plan and your comment, links it, and starts its breakdown. The follow-up is blocked by the original story.
8. **Dependencies:** a story can be "blocked by" others (set by the factory for follow-ups and split parts, or by you in the GitHub UI). Its plan can be approved at any time; the build waits in **Waiting** and starts when all blockers are done. `/start` builds it anyway.

The factory manages all `factory:*` labels; you never need to set them. Plain comments are read by an intent classifier only at the two gates and only from approvers; the bot always replies with what it understood.
