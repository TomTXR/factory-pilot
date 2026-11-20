# Wiki operation log removed

> Source: Operator finding and product owner decision, 2026-11-20
> Collected: 2026-11-20
> Published: 2026-11-20
> Synthetic: no

Finding: since every story PR updates the wiki (PR #58), every PR also appended an entry to the end of `knowledge/wiki/log.md`. Git merges line by line and reports a conflict when two branches change the same or adjacent lines; it does not guess. Two open PRs that both append at the end of the same file therefore always conflict. PR #62 conflicted twice in one night (with #58 and with #64, the backfill story). For a factory story each conflict costs a rework round (limit 3).

The product owner asked whether the conflict affects only log.md or other files too, and why the PRs do not merge correctly. Answer: git merges correctly; the file layout is the problem. Risk by file:
- log.md: every time (all PRs append at the same place).
- index.md: often (new rows at the end of a table; the Updated date changes in the row of every touched article).
- decisions/NNN-*.md: silent (two parallel PRs both create number 020 with different file names; no git conflict, but duplicate numbers).
- concept articles: sometimes, when two stories change the same concept. That is a real conflict and goes back to the builder automatically.

Decision (product owner, 2026-11-20): remove log.md. In the Infercom wiki the log is the only change history; here git history and the story records in raw/stories/ already say what changed, when and why. Git's union merge driver was rejected: GitHub does not apply custom merge drivers when it merges through the web or the API.
