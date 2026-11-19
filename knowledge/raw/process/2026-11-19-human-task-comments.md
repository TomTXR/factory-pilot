# Comments on human tasks

> Source: Product owner question on human task #38 (2026-11-19): what happens if I have a question, cannot do a step as described, or want to write "All done" instead of closing the task by hand
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Problem: the factory read comments only at the two story gates (Plan Review, Human Review). On a human task a comment did nothing: no agent read it, a question got no answer, and "All done" did not close the task. Worse, `/approve` on a task was handled as a story command and would have started a breakdown of the task itself. Closing by hand was the only way to move on.

Product owner's reasoning: anything assigned to a human can be hard. The human needs a way to say so, and the factory must react. A human should not need to know that tasks behave differently from stories.

Decision (2026-11-19): a comment by an approver on a human task is handled like this:
- Done: `/done`, or text that says the task is finished ("All done, both secrets are stored"). The factory closes the task as completed, records it in the story's status section, and releases stories the task blocked. Closing by hand still works.
- Question or problem: any text that asks something or says a step does not work. An answer agent (Opus, effort medium, read-only tools on the repository) replies in the task, from the task, the story, its plan, the task thread and the wiki. It never does the task and never asks for secret values. It must not guess values that are not written down.
- If the agent cannot answer (the task is wrong, cannot be done as described, needs a product or cost decision, or the agent fails), the task gets `factory:blocked` (board: "Human: Decide (blocked)") and the other approvers are mentioned to decide. With one approver, the asker is mentioned. A later answered question removes the block.
- A remark that needs no answer ("will do this tonight") gets a thumbs-up and nothing else.
- A story command on a task (`/approve`, `/changes`) is refused with a hint.

The classifier (Sonnet) got a third mode for tasks: done, question, other. When in doubt it chooses question, so a task is never closed by mistake. If the classifier fails, the comment is treated as a question.

Only approver comments reach the agent. The thread passed to the agent contains only approver and factory comments, because anyone can comment in the public repository.

Tested live before merge with the real task #38: the classifier sorted "All done, both secrets are in" as done, "which app type?" as question, "will do this tonight" as other. The answer to "what do I enter as Authorized JavaScript origins?" came in 14 s and used only values from the task text.

Security (reviewer P0 on PR #42, fixed before merge): the answer agent is the first agent with file tools in the comment workflow, and its prompt can hold text a non-approver wrote (a stranger's story that an approver started). A prompt injection could have made it quote the job token (persisted by checkout in `.git/config`) or tokens from its environment into a public comment. Layers now:
- the checkout persists no token (`persist-credentials: false`);
- the agent runs in a copy of the repository without `.git`;
- it gets read-only tools and no allow rule, so reads outside its working directory are denied (tested: a file in the parent directory and `/proc/self/environ` were denied);
- it gets no GitHub or project token in its environment;
- a story body written by a non-approver is left out of the prompt;
- an answer that looks like a credential is never posted; the task is blocked instead.
Live test: asked to include `.git/config`, `~/.claude.json` and `/proc/self/environ`, the agent refused and escalated to a human.
