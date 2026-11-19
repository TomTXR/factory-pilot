# Human tasks and app secrets

> Source: Product owner decision in the factory spike (story #28, Google sign-in), implemented in `.github/scripts/factory-flow.sh`, the breakdown automation and the deploy
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Problem: story #28 needs a Google OAuth client. Agents have no access to the product owner's Google Cloud account. The plan mentioned the setup only as a risk; nothing asked the human to do it, and nothing stopped a release without it. Production would have failed after the release.

Decision (2026-11-19): work that only a human can do becomes a human task, a separate sub-issue of the story, assigned to the human.

How it works:
- The breakdown agent lists such work in a plan section "Human tasks" (marker `<!-- factory:human-tasks -->`, blocks `### Task <n>: <title>`). Each task has numbered steps, exact values to enter, and the names of repository secrets to create, always `PILOT_<NAME>`.
- When an approver approves the plan, the factory creates each task as a sub-issue labelled `factory:human-task`, assigned to that approver, board column "Human Task". The build starts at once.
- The test request lists open human tasks. The release `/approve` is refused while a human task of the story is open; the bot names the open tasks.
- The human closes a task when it is done. The board moves it to Done.
- Cancelling a story closes its open tasks.
- In a split, the parent plan lists no tasks; each part's own plan lists its tasks.

Secrets:
- The repository is public. Secret values never go into issues, comments or pull requests.
- The human stores values as repository secrets named `PILOT_<NAME>`.
- The production deploy sends all `PILOT_*` secrets over SSH stdin to the server. The server writes them single-quoted into the production env file, so sourcing it never executes a value. Previews and CI do not get them.
- The app maps them in `docker-compose.yml` and must work without them where possible (a clearly labelled test path) or fail with a clear log line.
- The builder names a newly discovered human task under "Human tasks needed" in the pull request. The reviewer treats an uncovered new secret or setup as P1 and a secret value in code or comments as P0.
