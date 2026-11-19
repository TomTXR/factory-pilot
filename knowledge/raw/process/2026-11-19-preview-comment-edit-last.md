# Preview comment overwrote rework requests

> Source: Factory operator investigation of story #35, PR #45 (2026-11-19), after the product owner asked whether #35 was stuck
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

the preview step posted its link with `gh pr comment --edit-last`, which edits the newest comment of the same account (github-actions[bot]). After the CI rework at 14:35 that was the rework comment: the builder's instructions (failing tests) were overwritten by "Preview ready", and the `factory:rework` marker was gone, so the next rework (reviewer P0 at 14:47) counted as "1 of 3" again. The rework limit could never trigger, and a `factory:ci-failed`/`factory:conflict` marker could be lost the same way. Fix: the preview comment carries its own marker `<!-- factory:preview -->` and only that comment is updated; a test forbids `--edit-last` in workflows and scripts. The lost count on #45 is not restored (it would need a bot comment); #45 has one rework more than its counter shows.
