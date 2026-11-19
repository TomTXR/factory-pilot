# Follow-up stories from comments

> Source: Product owner decision in the factory spike (story #28, open question 2 "household sharing later"), implemented in `.github/scripts/factory-flow.sh`, `classify-intent.sh` and `write-followups.sh`
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Need: a plan often proposes to defer some work. The product owner wants to answer in free text, for example "Yes correct, please create a ticket for that", and get the ticket without writing it and without an extra approval step.

Decision (2026-11-19): an approver's explicit request for a ticket is the approval. The factory writes and creates the story and starts its breakdown at once. Nothing is built before the human approves the plan of the new story.

How it works:
- The intent classifier (Claude Sonnet, effort medium) reads every approver comment at Plan Review and Human Review. Besides the intent it returns `followup`: true only when the comment explicitly asks for a separate ticket. Deferring something without asking for a ticket is not a request.
- `/followup <what>` is the explicit form. It works in every state and does not change the state of the story. It can stand next to `/approve` in the same comment.
- The ticket writer (Claude Opus, effort medium, no tools) gets the story, the latest plan and the comment. It writes one story per requested ticket, in the issue template sections (Story, Acceptance criteria, Out of scope, Context and references), uses only what the sources say, and lists undecided points as open questions.
- The factory creates each story with `factory:story`, a link "Follow-up of #N, requested by @approver" and the comment link, posts the list on the original story, and starts the breakdown of each new story.
- The rest of the comment is handled as before (answers give a refined plan, approval starts the build). Each comment creates its follow-ups only once.
- First real test data (story #28): the classifier returned intent changes with followup true for answers that confirmed the defaults and asked for a household-sharing ticket; the writer produced one story with 9 acceptance criteria, the dependency on per-account data, and 8 open questions.
