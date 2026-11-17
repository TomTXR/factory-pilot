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

Lander test.

Lander test 2.
