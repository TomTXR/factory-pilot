# A plan criterion for data that did not exist cost two reworks

> Source: Story #35 (part 2 of #28), PR #45, and the product owner's reflection in the factory spike session (2026-11-19): "I remember when I reviewed it I thought about it, but as it proposed this scenario (first one to log in takes it) I said yes. I should have been more strict and rule out that non-existing edge scenario."
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

What happened: the plan of #35 (per-account properties) contained acceptance criterion 5: properties without an owner that exist at deploy time are taken over by the first account that signs in. The plan itself noted that production had no properties (product owner's answer on #28). The product owner approved the plan with this criterion.

The rule collided with other parts of the same plan (the duplicate check per account, 30-day sessions from story #34):
- Rework 2 (reviewer P0): the claim could fail on the per-account unique index and lock an account out of sign-in.
- Rework 3 (reviewer P1): the fix skipped colliding rows, and the next account to sign in claimed them and saw the first account's notes.
Each fix closed one edge case and the reviewer found the next; the reviewer was right every time. The problem was the rule, not the code. A check of production on 2026-11-19 found 0 properties and 1 user: the rule protected nothing.

Decision (2026-11-19, product owner): drop criterion 5. Properties without an owner stay invisible and are never claimed automatically; if such rows ever exist, a one-off human task assigns them. Sent to the builder as `/changes` on #35.

Lessons:
1. At plan review, reject criteria for scenarios that cannot occur. If the product owner has said the data or situation does not exist, the plan lists it under Out of scope instead of building for it. Edge-case machinery for non-existing data is the most expensive kind of scope: it is hard to get right and nobody can test it with real data.
2. Signal: when consecutive review findings are about the same rule, and each fix produces the next finding, the rule is wrong, not the code. Such a story should go back to the human, not into another build round. (Not built yet; recorded as an open item.)
