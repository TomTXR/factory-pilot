# Idea: the factory develops itself

> Source: Product owner question in the factory spike session (2026-11-19): "theoretically I should be able to manage my software factory via a software factory, right? The work I'm doing here in this session could well be a software factory project." Follow-up: "I didn't mean to set up this paradigm, it was more a question if we could, and if we would want to."
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Status: idea, not decided, not planned. Recorded so it is not lost.

Context: on 2026-11-19 the factory itself was changed many times in one session with a human operator and a coding assistant (task comments PR #42, CI failure rework PR #43, conflict check PR #44, preview comment PR #47). Each change already had the lifecycle of a story: a problem, a plan, code, tests, an agent review by the factory's reviewer agent, a merge, wiki notes. Some steps were human tasks (VM changes, uploading the breakdown bundle, repository settings).

Answer given: yes, we could, and we would want to at some point.
- Could: nothing in the factory is specific to app code. A factory change is a story like any other.
- Would want to: factory changes would get the same discipline as app changes (plan, review, recorded decision, wiki), which today depends on the operator. The factory would learn from its own failures the way it learns from app stories.

What fits already:
- A factory change as a story with a plan and open questions; the human approves the plan.
- VM, automation bundle and repository-setting changes as human tasks.
- The reviewer agent already reviews every factory PR and found real defects (for example a P0 credential leak path in PR #42).
- Wiki updates are already part of the builder's rules.

What needs care before doing it:
1. Lockout: a broken factory change can break the factory that has to repair it (a mild example: the preview comment overwrote rework requests, PR #45). A manual escape route must stay: a human can always push and merge directly, and a known-good factory version stays pinned.
2. Self-granted rights: agents that edit workflows holding secrets and write permissions could widen their own access. Changes to workflows and permissions need an explicit human `/approve`. The builder's token should not be able to push `.github/workflows` (believed true today, not verified).
3. Testing: an app story has a preview to click through; a factory change does not. Its test step would be a run against a separate test repository (as in the spike's dry runs).
4. Operations: much of the session was diagnosis ("#34 is stuck", "#35 looks stuck"). That only becomes a story once something notices it. A watchdog that detects stuck stories (no agent activity for a long time, a red head without rework, a conflicting PR) and opens a ticket would turn stalls into stories.

Suggested order if pursued: after the spike; first a separate, app-agnostic factory repository with a pinned stable version serving the DomiGO repository; then the watchdog as the first self-hosted story.
