# Wiki layout for parallel PRs: no dates in the index, no decision numbers

> Source: Product owner decision, 2026-11-20 (answer "yes" to the operator's proposal)
> Collected: 2026-11-20
> Published: 2026-11-20
> Synthetic: no

After the operation log was removed, two further collision risks remained:

1. index.md: new rows were appended at the end of each table, and the Updated column changed in the row of every article a PR touched. Two parallel PRs therefore often changed the same or adjacent lines.
2. Decision records were numbered (001 to 019). Two parallel PRs would both create 020 with different file names: git reports no conflict, but two decisions share a number.

Decision: remove the Updated column from the index (each article keeps its date in its header) and sort the rows alphabetically by title, so that parallel additions land on different lines. Name decision records after the decision, without a number; the existing 19 records were renamed and all links updated. The index lists decisions by title.

Noted, not changed: database migrations are also numbered (`api/migrations/NNN_name.sql`), with the same silent-duplicate risk.
