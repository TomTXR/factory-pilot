# Board column names say who acts

> Source: Product owner request on the factory board, 2026-11-19
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

The board columns were named after factory states (Inbox, Plan Review, Human Review, Blocked). A human could not see at a glance where a person had to act. The product owner asked to rename them so that any human sees where actions for humans wait.

Decision: every column name starts with who acts next. Human columns: "Human: Start story" (Inbox: a story added on the board without the template, a reopened story, or a story by a non-approver waits for `/start`), "Human: Review plan", "Human: Test and release", "Human: Do task", "Human: Decide (blocked)". Agent columns: "Agent: Planning", "Agent: Building", "Agent: Reviewing", "Agent: Reworking", "Agent: Deploying". Others: "Waiting: Blocked by other story", "Split: Parts in progress", "Done", "Cancelled". "Human" instead of "You", because several approvers share the board. The scripts keep internal state names; one mapping in `board-status.sh` translates them.
