---
name: wiki
description: Read and maintain the project knowledge wiki in knowledge/ (Karpathy LLM Wiki pattern). Use before planning, building or reviewing a story (read the concept map and the relevant articles); in every PR that changes the app (update the articles, the concept map, decision records and the story record); when asked to ingest a source, query the knowledge, or lint the wiki.
---

# Project Knowledge Wiki

`knowledge/` is the shared knowledge pool of this project, for humans and agents. Its main reader is the next agent: it must understand which concepts exist, how they relate, how they are built and why, without reading the full source code. Agents write and maintain it with every change; humans read it and ask questions.

## Layout

```
knowledge/
├── raw/<topic>/YYYY-MM-DD-slug.md   immutable sources (never edit after creation)
└── wiki/
    ├── index.md                     start here: concept map, then every article with link, one-line summary, Updated date
    ├── log.md                       append-only operation log
    └── <topic>/<article>.md         compiled articles (one level of topics only)
```

| Topic | Holds | Template |
|-------|-------|----------|
| `product` | Product concepts and features: purpose, rules, status, relations | `concept-template.md` |
| `architecture` | How the software is built: system, data model, API, auth, deploy | `concept-template.md` |
| `design` | Design concepts, UI patterns, screens; small SVG/PNG files in `design/assets/` | `concept-template.md` |
| `decisions` | One record per decision, named `NNN-slug.md` | `decision-template.md` |
| `users` | Personas and their needs | `article-template.md` |
| `process`, `lessons` | How the factory works and why its rules exist | `article-template.md` |

Add a topic only for a genuinely distinct area, and add it to this table, `AGENTS.md` and `wiki/index.md`. Templates: `references/` next to this file.

### Index (`index.md`)

The single entry point, read in full by every agent before it works. Two parts:

1. **Concept map:** a Mermaid diagram of the concepts and their relations, then a table with one row per concept: concept, article, code entry point (file paths), related concepts. Change it whenever a concept or relation is added, renamed, changed or removed.
2. **Articles by topic:** every article with link, one-line summary and Updated date. The summary must let an agent decide whether the article is relevant without opening it: name the concepts, rules and decisions it holds.

## Rules

1. **Read before working.** Before planning, building or reviewing, read all of `wiki/index.md`, decide from the concept map and the summaries which articles are relevant to your task, and read them. A plan's "Context used" is a minimum, not a limit. Prefer wiki content over model knowledge and over reading all the code. If the wiki has no answer to a product question, ask the human in the issue; do not guess.
2. **Cite.** In a ticket spec, list the wiki articles you used under "Context used". In articles, every claim cites its raw source.
3. **Never edit `raw/`** after a file is merged. Sources are evidence. Until the merge, the story record of your own PR may be edited.
4. **Never overwrite silently.** If a new source contradicts an article, keep both claims and annotate the conflict with both sources.
5. **Writes go with the change.** The PR that changes the app updates the wiki, in a separate commit. The agent reviewer checks it; CI fails without it. No human reviews the wiki.
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

### record (factory, in every story PR)

Write what the story built and decided, in the story's own PR, before it is ready for review. Repeat steps 2 to 5 on every rework and revision.

1. Create `raw/stories/YYYY-MM-DD-story-<issue>-<slug>.md` with: goal, acceptance criteria, questions asked and the human answers, decisions taken (by whom), concepts added or changed, rework reasons and review findings so far.
2. Update or create the concept articles (product, architecture, design) of every concept the PR adds or changes: purpose, rules, relations, code entry points. Name articles after the concept, not the story.
3. Add a decision record in `decisions/` for every decision: a human answer in the issue, or a technical choice in the code that a later agent could question (for example a session lifetime, a data ownership rule, a library). Mark a replaced decision as superseded; do not delete it.
4. Cascade: update every other article the change makes wrong, with bidirectional See Also links.
5. Update `index.md` (concept map, summaries, Updated dates) and `log.md` (`## [YYYY-MM-DD] record | story #<n>`). Human answers to agent questions are the most valuable part: they must end up in an article, so the question is not asked again.

### query

1. Read `wiki/index.md` in full, then every article that is relevant by the concept map and the summaries.
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
- Write for the next agent: what exists, how it relates, where the code is, why it is like this. Do not copy code.
