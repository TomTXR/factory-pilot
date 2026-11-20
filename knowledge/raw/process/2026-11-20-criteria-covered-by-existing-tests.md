# Criteria covered by existing tests

> Source: First live run of the criteria check on #59 (PR #67); product owner direction, 2026-11-20
> Collected: 2026-11-20
> Published: 2026-11-20
> Synthetic: no

After the criteria check was merged (PR #68), PR #67 (#59) was updated with main. CI failed with AC1 to AC17 untested; the rework quoted every line; the builder tagged its tests in one round. It marked AC15 ("the existing add, edit and delete flows behave as before") as `Not automated`, with the reason that existing tests cover it. The reviewer accepted that.

Gap: "Not automated" was meant for criteria no test can check. AC15 is tested, by older tests without the ID. One label covered two different cases. The product owner asked for a clean solution.

Analysis (operator): two cases, each with a standard answer, no new mechanism:
1. A criterion that only says existing behaviour stays unchanged is not a criterion of the story: the full suite runs on every PR and guarantees it for every story. The breakdown prompt now says so.
2. An existing test that already proves a new criterion gets the ID added to its title (`'#46 AC4, #59 AC13: ...'`): many-to-many traceability, as in test management tools. The check already accepted it; a test case now covers it.
"Not automated" stays only for criteria no test can check. The reviewer reports a "Not automated" reason that points to existing tests as P1.

#59 keeps its AC15 line: it is in human review, built under the earlier wording, and a new rework round would cost the tester another test.
