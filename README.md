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

1. **New story:** GitHub -> Issues -> New issue -> "User story". The breakdown starts automatically.
2. **Plan ready** (you get a notification): read the plan, then reply in a comment. Answers or change requests lead to a refined plan; `/approve` (or a clear "looks good, go ahead") starts the build.
3. **Test request** (you get a notification with the test link): test on the preview, then reply. A description of what is wrong (or `/changes <what>`) makes the builder revise the PR; **only an explicit `/approve` releases to production**.
4. **Blocked:** read the bot's explanation, then `/retry` (optionally with instructions).

The factory manages all `factory:*` labels; you never need to set them. Plain comments are read by an intent classifier only at the two gates and only from approvers; the bot always replies with what it understood.
