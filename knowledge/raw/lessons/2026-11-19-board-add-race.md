# Board status lost by a race with the board's auto-add

> Source: Operator investigation of story #61, 2026-11-19
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

The product owner saw story #61 (part 3 of the split of #57) with "no status" on the board. The split run (Actions run 44617447028) created the part at 21:18:58. At 21:19:00 the project's own auto-add workflow (github-project-automation) added the issue to the board, and in the same second the factory's `addProjectV2ItemById` call failed with `UNPROCESSABLE: Content already exists in this project`. The script stopped before setting the status ("board update failed" warning); the run continued, so nothing else noticed. #60 (one second earlier) was not hit.

The call is otherwise idempotent: a later call returns the existing item (verified by setting #61 to Waiting by hand afterwards). Fix: retry the add once after 3 seconds. Test: tests/board-status.test.sh with a stubbed curl.
