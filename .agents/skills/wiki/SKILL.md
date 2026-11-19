---
name: wiki
description: Read and maintain the project knowledge wiki in knowledge/ (Karpathy LLM Wiki pattern). Use before making product, domain or user assumptions; when a story is done (capture what was learned); when asked to ingest a source, query the knowledge, or lint the wiki.
---

# Project Knowledge Wiki

`knowledge/` is the shared knowledge pool of this project, for humans and agents. Agents write and maintain it; humans read it, ask questions and approve changes through pull requests.

## Layout

```
knowledge/
├── raw/<topic>/YYYY-MM-DD-slug.md   immutable sources (never edit after creation)
└── wiki/
    ├── index.md                     every article: link, one-line summary, Updated date
    ├── log.md                       append-only operation log
    └── <topic>/<article>.md         compiled articles (one level of topics only)
```

Topics: `product`, `domain`, `users`, `process`, `decisions`, `lessons`. Add a topic only for a genuinely distinct area, and add it to `wiki/index.md` with a one-line description.

Templates: `references/` next to this file.

## Rules

1. **Query before assuming.** Before making a product, domain or user assumption, read `knowledge/wiki/index.md`, then the relevant articles. Prefer wiki content over model knowledge. If the wiki has no answer, ask the human in the issue; do not guess.
2. **Cite.** In a ticket spec, list the wiki articles you used under "Context used". In articles, every claim cites its raw source.
3. **Never edit `raw/`** after a file is created. Sources are evidence.
4. **Never overwrite silently.** If a new source contradicts an article, keep both claims and annotate the conflict with both sources.
5. **Writes go through pull requests.** Wiki changes are reviewed by a human like code. In a ticket PR, keep wiki changes in a separate commit.
6. **Synthetic data stays labelled.** Sources marked SYNTHETIC remain marked in every article that uses them.

## Operations

### ingest

Turn a source into knowledge. Always all steps.

1. Save the source to `raw/<topic>/YYYY-MM-DD-slug.md` using `references/raw-template.md`. Preserve the original text; only clean formatting noise.
2. Compile: merge into the article with the same core subject, or create a new article (named after the concept, not the source) using `references/article-template.md`. Distill, do not copy.
3. Contradiction check against existing articles (rule 4).
4. Cascade: update every article whose content is materially affected. Add bidirectional See Also links.
5. Update `wiki/index.md` (every touched article, with Updated date) and append to `wiki/log.md`:
   ```
   ## [YYYY-MM-DD] ingest | <primary article title>
   - Raw: <raw path>
   - Updated: <other article title>
   ```

### capture (factory, after a story is done)

Write the story record as a source and ingest it:

1. Create `raw/stories/YYYY-MM-DD-story-<issue>-<slug>.md` with: goal, acceptance criteria, questions asked and the human answers, decisions taken, rework reasons, review findings.
2. Run **ingest** on it. Human answers to agent questions are the most valuable part: they must end up in an article, so the question is not asked again.

### query

1. Read `wiki/index.md`, then the relevant articles.
2. Answer with links to the articles used. Do not write files unless asked to archive.

### lint

Deterministic, fix automatically:
- Every article file appears in `wiki/index.md`; every index entry points to an existing file.
- Every relative link and every Raw reference resolves.
- See Also links are bidirectional.

Heuristic, report only (issue or PR comment):
- Contradictions between articles without annotation
- Claims superseded by newer sources
- Orphan articles (no inbound links)
- Concepts mentioned often but without their own article

Append `## [YYYY-MM-DD] lint | <N> issues found, <M> auto-fixed` to `wiki/log.md`.

## Conventions

- Standard markdown, relative links, dates as YYYY-MM-DD.
- No emojis.
- Keep articles short and factual; one concept per article.
