#!/usr/bin/env bash
# Tests for .github/scripts/factory-flow.sh with a stubbed gh CLI.
# Each case writes fixtures, runs one command and checks the logged gh calls.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/.github/scripts/factory-flow.sh"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin" "$WORK/fx"
cat > "$WORK/bin/gh" <<'STUB'
#!/usr/bin/env bash
# Stub: log the call, answer API reads from fixture files.
echo "$*" >> "$GH_LOG"
# Log the content of file bodies too (status section, created issues).
for a in "$@"; do case "$a" in body=@*) f="${a#body=@}"; [ -f "$f" ] && sed 's/^/  | /' "$f" >> "$GH_LOG" ;; esac; done
if [ "$1" = "api" ]; then
  path=""; for a in "$@"; do case "$a" in repos/*) path="$a"; break ;; esac; done
  # Stateful issue body edits (status section).
  case "$*" in *"-X PATCH"*) for a in "$@"; do case "$a" in body=@*)
    n="${path##*/}"; f="$FX/issue-$n.json"; [ -f "$f" ] || { [ -f "$FX/issue.json" ] && cp "$FX/issue.json" "$f" || echo '{"labels":[]}' > "$f"; }
    jq --rawfile b "${a#body=@}" '.body = $b' "$f" > "$f.t" && mv "$f.t" "$f" ;; esac; done; echo '{}'; exit 0 ;; esac
  case "$path" in
    */reactions) case "$*" in *"-X POST"*) echo '{}' ;; *) cat "$FX/reactions.json" 2>/dev/null || echo '[]' ;; esac ;;
    */dependencies/blocked_by*) case "$*" in *"-X POST"*) echo '{}' ;; *) dn=${path%/dependencies*}; dn=${dn##*/}; cat "$FX/blocked_by-$dn.json" 2>/dev/null || echo '[]' ;; esac ;;
    */dependencies/blocking*) dn=${path%/dependencies*}; dn=${dn##*/}; cat "$FX/blocking-$dn.json" 2>/dev/null || echo '[]' ;;
    */sub_issues*) case "$*" in *"-X POST"*) echo '{}' ;; *) pn=${path%/sub_issues*}; pn=${pn##*/}; cat "$FX/sub_issues-$pn.json" 2>/dev/null || cat "$FX/sub_issues.json" 2>/dev/null || echo '[]' ;; esac ;;
    */issues\?*) cat "$FX/bot_issues.json" 2>/dev/null || echo '[]' ;;
    */issues) [ -n "${GH_FAIL_CREATE:-}" ] && exit 1; n=$(( $(cat "$FX/next" 2>/dev/null || echo 100) )); echo $((n+1)) > "$FX/next"; echo "{\"number\":$n,\"id\":$((n*1000))}" ;;
    */pulls/*/reviews/*) cat "$FX/review.json" ;;
    */pulls/*/reviews) cat "$FX/reviews.json" ;;
    */pulls\?*) cat "$FX/open_pulls.json" ;;
    */pulls/*) cat "$FX/pull.json" ;;
    */issues/comments/*) cat "$FX/comment.json" ;;
    */issues/*/comments) cat "$FX/comments.json" ;;
    */issues/*) if [ -f "$FX/issue-${path##*/}.json" ]; then cat "$FX/issue-${path##*/}.json"; elif [ -f "$FX/issue.json" ]; then cat "$FX/issue.json"; else echo '{"node_id":"I_test","labels":[]}'; fi ;;
    *) echo '{}' ;;
  esac
fi
if [ "$1" = "issue" ] && [ "$2" = "close" ]; then
  # Stateful close: later reads see the issue as closed (as on GitHub).
  n="$3"; r=completed; case "$*" in *"not planned"*) r=not_planned ;; esac
  f="$FX/issue-$n.json"; [ -f "$f" ] && jq --arg r "$r" '.state = "closed" | .state_reason = $r' "$f" > "$f.t" && mv "$f.t" "$f"
  for sf in "$FX"/sub_issues*.json; do
    [ -f "$sf" ] && jq --argjson n "$n" --arg r "$r" 'map(if .number == $n then .state = "closed" | .state_reason = $r else . end)' "$sf" > "$FX/s.t" && mv "$FX/s.t" "$sf"
  done
fi
exit 0
STUB
chmod +x "$WORK/bin/gh"
export PATH="$WORK/bin:$PATH" FX="$WORK/fx" GH_LOG="$WORK/gh.log"
export GITHUB_REPOSITORY=owner/repo FACTORY_AGENT_LOGINS=agentbot PROJECT_TOKEN= PROJECT_LOGIN=x PROJECT_NUMBER=1

M='<!-- openhands-review-run: abc -->'
pass=0; fail=0
setup() { # head_ref review_author review_body
  : > "$GH_LOG"
  jq -n --arg ref "$1" '{state:"open", head:{ref:$ref, sha:"sha1"}}' > "$FX/pull.json"
  jq -n --arg u "$2" --arg b "$3" '{user:{login:$u}, body:$b, html_url:"https://x/review"}' > "$FX/review.json"
  echo '[]' > "$FX/reviews.json"; echo '[]' > "$FX/comments.json"; rm -f "$FX"/issue*.json "$FX/comment.json" "$FX"/sub_issues*.json "$FX/bot_issues.json" "$FX"/blocked_by-*.json "$FX"/blocking-*.json "$FX/reactions.json" "$FX/next" "$WORK/out"
  jq -n '[{number:16, head:{ref:"factory/issue-5"}}, {number:17, head:{ref:"factory/issue-50"}}]' > "$FX/open_pulls.json"
}
check() { # name expected(yes|no) pattern
  if grep -qE -- "$3" "$GH_LOG"; then got=yes; else got=no; fi
  if [ "$got" = "$2" ]; then pass=$((pass+1)); echo "ok   $1"; else fail=$((fail+1)); echo "FAIL $1 (expected '$3' present=$2)"; sed 's/^/     /' "$GH_LOG"; fi
}

# 1. Forged review from a non-agent account is ignored.
setup factory/issue-5 mallory "$M
🔄 CHANGES REQUESTED"
"$SCRIPT" review 16 1 >/dev/null
check "forged review ignored (no close)" no "pr close"
check "forged review ignored (no comment)" no "issue comment"

# 2. Agent review without the OpenHands marker is ignored.
setup factory/issue-5 agentbot "🔄 CHANGES REQUESTED"
"$SCRIPT" review 16 1 >/dev/null
check "unmarked agent review ignored" no "pr close"

# 3. Agent CHANGES REQUESTED with an open builder PR -> revise that PR (no close).
setup factory/issue-5 agentbot "$M
🔄 CHANGES REQUESTED"
"$SCRIPT" review 16 1 >/dev/null
check "rework does not close the PR" no "pr close"
check "rework posts findings on the PR" yes "pr comment 16"
check "rework leaves other issues' PRs alone" no "pr comment 17"
check "rework sets review status failure" yes "statuses/sha1 -f state=failure -f context=software-factory/review"
check "rework moves issue to rework" yes "issue edit 5 --repo owner/repo --add-label factory:rework"
check "rework clears blocked" yes "issue edit 5 --repo owner/repo --remove-label factory:blocked"

# 3b. No open builder PR -> builder starts again via the trigger label.
setup factory/issue-5 agentbot "$M
🔄 CHANGES REQUESTED"
echo '[]' > "$FX/open_pulls.json"
"$SCRIPT" review 16 1 >/dev/null
check "no PR: builder re-triggered" yes "issue edit 5 --repo owner/repo --add-label factory:plan-approved"

# 3c. Agent APPROVED sets the review status success.
setup factory/issue-5 agentbot "$M
✅ APPROVED"
PREVIEW_HEALTH_CMD=false "$SCRIPT" review 16 1 >/dev/null
check "approval sets review status success" yes "statuses/sha1 -f state=success"

# 4. Forged rework markers from other accounts do not count towards the limit.
setup factory/issue-5 agentbot "$M
🔄 CHANGES REQUESTED"
jq -n '[range(3) | {user:{login:"mallory"}, body:"<!-- factory:rework -->"}]' > "$FX/comments.json"
"$SCRIPT" review 16 1 >/dev/null
check "forged rework markers ignored" no "add-label factory:blocked"

# 5. Three rework comments by the automation reach the limit -> blocked.
setup factory/issue-5 agentbot "$M
🔄 CHANGES REQUESTED"
jq -n '[range(3) | {user:{login:"github-actions[bot]"}, body:"<!-- factory:rework -->"}]' > "$FX/comments.json"
"$SCRIPT" review 16 1 >/dev/null
check "rework limit blocks" yes "add-label factory:blocked"
check "rework limit does not close PR" no "pr close"
check "rework limit stops builder revisions" yes "statuses/sha1 -f state=pending"

# 6. ready-check ignores a forged approval on the head.
setup factory/issue-5 agentbot "x"
jq -n --arg m "$M" '[{commit_id:"sha1", user:{login:"agentbot"}, body:($m+"\n🔄 CHANGES REQUESTED")},
                     {commit_id:"sha1", user:{login:"mallory"}, body:($m+"\n✅ APPROVED")}]' > "$FX/reviews.json"
PREVIEW_HEALTH_CMD=true "$SCRIPT" ready-check 16 >/dev/null
check "forged approval does not reach human review" no "add-label factory:human-review"

# 7. ready-check with agent approval and healthy preview posts the test request.
setup factory/issue-5 agentbot "x"
jq -n --arg m "$M" '[{commit_id:"sha1", user:{login:"agentbot"}, body:($m+"\n✅ APPROVED")}]' > "$FX/reviews.json"
PREVIEW_HEALTH_CMD=true "$SCRIPT" ready-check 16 >/dev/null
check "approved + healthy -> human review" yes "add-label factory:human-review"
check "approved + healthy -> test request" yes "issue comment 5"

# 8. Not a factory branch -> nothing.
setup feature/x agentbot "$M
✅ APPROVED"
"$SCRIPT" review 16 1 >/dev/null
check "non-factory PR ignored" no "issue (edit|comment)"

# 9. Missing FACTORY_AGENT_LOGINS fails loudly instead of silently matching nothing.
setup factory/issue-5 agentbot "x"
if FACTORY_AGENT_LOGINS= PREVIEW_HEALTH_CMD=true "$SCRIPT" ready-check 16 >/dev/null 2>&1; then
  fail=$((fail+1)); echo "FAIL empty agent list must exit non-zero"
else
  pass=$((pass+1)); echo "ok   empty agent list fails loudly"
fi

# 10. Plan ready: notify approvers once per plan comment; ignore forged plan comments.
setup factory/issue-5 agentbot "x"
jq -n '[{id:11, user:{login:"mallory"}, body:"<!-- factory:breakdown -->\nfake"}]' > "$FX/comments.json"
FACTORY_APPROVERS=alice,bob "$SCRIPT" plan-ready 5 >/dev/null
check "forged plan comment does not notify" no "issue comment 5"
jq -n '[{id:12, user:{login:"agentbot"}, body:"<!-- factory:breakdown -->\nplan"}]' > "$FX/comments.json"
: > "$GH_LOG"; FACTORY_APPROVERS=alice,bob "$SCRIPT" plan-ready 5 >/dev/null
check "plan ready comments on the issue" yes "issue comment 5"
check "plan ready mentions the approvers" yes "@alice @bob"
jq -n '[{id:12, user:{login:"agentbot"}, body:"<!-- factory:breakdown -->\nplan"},
        {id:13, user:{login:"github-actions[bot]"}, body:"<!-- factory:plan-ready 12 -->"}]' > "$FX/comments.json"
: > "$GH_LOG"; FACTORY_APPROVERS=alice,bob "$SCRIPT" plan-ready 5 >/dev/null
check "plan ready notifies only once" no "issue comment 5"

# 11. Plan ready without approvers fails loudly and writes no marker.
jq -n '[{id:12, user:{login:"agentbot"}, body:"<!-- factory:breakdown -->\nplan"}]' > "$FX/comments.json"
: > "$GH_LOG"
if FACTORY_APPROVERS= "$SCRIPT" plan-ready 5 >/dev/null 2>&1; then
  fail=$((fail+1)); echo "FAIL empty approver list must exit non-zero"
else
  pass=$((pass+1)); echo "ok   empty approver list fails loudly"
fi
check "no marker without approvers" no "issue comment 5"

# ---- Comment commands -------------------------------------------------------
cat > "$WORK/bin/classify-stub" <<'STUB'
#!/usr/bin/env bash
echo "$1" >> "$CLASSIFY_LOG"; printf '{"intent":"%s","summary":"stub","followup":%s}\n' "$CLASSIFY_INTENT" "${CLASSIFY_FOLLOWUP:-false}"
STUB
chmod +x "$WORK/bin/classify-stub"
export CLASSIFY_CMD="$WORK/bin/classify-stub" CLASSIFY_LOG="$WORK/classify.log" FACTORY_APPROVERS=alice
cmd() { # state-label author body [intent]
  setup factory/issue-5 agentbot "x"; : > "$CLASSIFY_LOG"
  jq -n --arg l "$1" '{node_id:"I_test", labels:([{name:"factory:story"}] + (if $l == "" then [] else [{name:$l}] end))}' > "$FX/issue.json"
  jq -n --arg u "$2" --arg b "$3" '{user:{login:$u, type:"User"}, body:$b, html_url:"https://x/c"}' > "$FX/comment.json"
  CLASSIFY_INTENT="${4:-unclear}" GITHUB_OUTPUT="$WORK/out" "$SCRIPT" command 5 900 >/dev/null 2>&1
}
out_has() { grep -q "$1" "$WORK/out" 2>/dev/null; }

cmd factory:plan-review mallory "/approve"
check "C1 non-approver command ignored" no "issue (edit|comment)"

cmd factory:plan-review alice "/approve"
check "C2 /approve at plan review starts builder" yes "add-label factory:plan-approved"
check "C2 acknowledged with a reaction, not a comment" yes "comments/900/reactions -f content=\+1"

cmd factory:plan-review alice "Please also add a delete dialog" changes
check "C3 inferred changes at plan review -> refined plan" yes "add-label factory:breakdown"
grep -q plan-review "$CLASSIFY_LOG" && { pass=$((pass+1)); echo "ok   C3 classifier called with state"; } || { fail=$((fail+1)); echo "FAIL C3 classifier not called"; }

cmd factory:human-review alice "Works, ship it" approve
check "C4 inferred approve at human review does not release" no "add-label factory:approved-for-production"
check "C4 asks for explicit /approve" yes "explicit decision"
out_has land=true && { fail=$((fail+1)); echo "FAIL C4 must not land"; } || { pass=$((pass+1)); echo "ok   C4 no land output"; }

cmd factory:human-review alice "/approve"
check "C5 explicit /approve at human review releases" yes "add-label factory:approved-for-production"
out_has land=true && { pass=$((pass+1)); echo "ok   C5 land output"; } || { fail=$((fail+1)); echo "FAIL C5 missing land output"; }

cmd factory:human-review alice "/changes the footer is too small"
check "C6 /changes at human review -> revise PR" yes "statuses/sha1 -f state=failure"
[ -s "$CLASSIFY_LOG" ] && { fail=$((fail+1)); echo "FAIL C6 classifier must not run for explicit command"; } || { pass=$((pass+1)); echo "ok   C6 no classifier for explicit command"; }

cmd factory:plan-review alice "/approve"; jq -n '[{user:{login:"github-actions[bot]"}, body:"<!-- factory:ack 900 -->\ndone"}]' > "$FX/comments.json"
: > "$GH_LOG"; GITHUB_OUTPUT="$WORK/out" "$SCRIPT" command 5 900 >/dev/null 2>&1
check "C7 already handled comment is not processed twice" no "issue (edit|comment)"

cmd factory:agent-review alice "just a note while you work"
check "C8 plain comment while agents work: no action" no "issue (edit|comment)"
[ -s "$CLASSIFY_LOG" ] && { fail=$((fail+1)); echo "FAIL C8 classifier must not run outside gates"; } || { pass=$((pass+1)); echo "ok   C8 no classifier outside gates"; }

cmd "" alice "/start"
check "C9 /start on a new story starts breakdown" yes "add-label factory:breakdown"

cmd factory:blocked alice "/retry"
check "C10 /retry when blocked with open PR -> revise" yes "statuses/sha1 -f state=failure"

cmd factory:plan-review alice "what does point 3 mean?" unclear
check "C11 unclear at plan review: no state change" no "issue edit"
check "C11 unclear: explains the commands" yes "No action taken"

setup factory/issue-5 agentbot "x"; jq -n '{node_id:"I_test", user:{login:"alice"}, labels:[{name:"factory:story"}]}' > "$FX/issue.json"
"$SCRIPT" start 5 >/dev/null
check "S1 new story by approver starts breakdown" yes "add-label factory:breakdown"
jq -n '{node_id:"I_test", user:{login:"mallory"}, labels:[{name:"factory:story"}]}' > "$FX/issue.json"; rm -f "$FX/issue-5.json"; : > "$GH_LOG"
"$SCRIPT" start 5 >/dev/null
check "S3 story by a stranger does not start" no "issue edit"
cmd "" alice "/approve"; jq -n '{node_id:"I_test", user:{login:"mallory"}, labels:[{name:"factory:story"}]}' > "$FX/issue.json"
: > "$GH_LOG"; GITHUB_OUTPUT="$WORK/out" "$SCRIPT" command 5 900 >/dev/null 2>&1
check "S4 approver /approve starts a stranger's story" yes "add-label factory:breakdown"
jq -n '{node_id:"I_test", user:{login:"alice"}, labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue.json"; : > "$GH_LOG"
"$SCRIPT" start 5 >/dev/null
check "S2 start does not reset a story in progress" no "issue edit"

# ---- Closing, cancelling, reopening ------------------------------------------
setup factory/issue-5 agentbot "x"; jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue.json"
GITHUB_OUTPUT="$WORK/out" "$SCRIPT" closed 5 not_planned >/dev/null
check "X1 not planned -> cancelled label" yes "add-label factory:cancelled"
check "X1 not planned -> plan-review removed" yes "remove-label factory:plan-review"
check "X1 not planned closes the story's open PR" yes "pr close 16"
check "X1 does not touch other stories' PRs" no "pr close 17"
out_has cleanup_pr=16 && { pass=$((pass+1)); echo "ok   X1 preview cleanup requested"; } || { fail=$((fail+1)); echo "FAIL X1 missing cleanup output"; }

setup factory/issue-5 agentbot "x"; jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:cancelled"}]}' > "$FX/issue.json"
"$SCRIPT" closed 5 not_planned >/dev/null
check "X2 already cancelled: no action" no "issue edit|pr close"

setup factory/issue-5 agentbot "x"; jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:human-review"}]}' > "$FX/issue.json"
"$SCRIPT" closed 5 completed >/dev/null
check "X3 closed as completed clears state labels" yes "remove-label factory:human-review"
check "X3 closed as completed keeps PRs" no "pr close"

cmd factory:human-review alice "/cancel duplicate of #3"
check "X4 /cancel closes the issue as not planned" yes "issue close 5 --repo owner/repo --reason not planned"
check "X4 /cancel sets cancelled" yes "add-label factory:cancelled"

cmd factory:plan-review alice "please close this, created by mistake" cancel
check "X5 inferred cancel only asks for /cancel" no "issue close"
check "X5 inferred cancel asks" yes "needs an explicit decision"

cmd factory:done alice "/cancel"
check "X6 /cancel on a done story: no close" no "issue close"

setup factory/issue-5 agentbot "x"; jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:cancelled"}]}' > "$FX/issue.json"
"$SCRIPT" reopened 5 >/dev/null
check "X7 reopened clears cancelled" yes "remove-label factory:cancelled"
check "X7 reopened explains /start in the status" yes "Reopened. Human: Start story"

# X8. Duplicate is handled like not planned.
setup factory/issue-5 agentbot "x"; jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:human-review"}]}' > "$FX/issue.json"
GITHUB_OUTPUT="$WORK/out" "$SCRIPT" closed 5 duplicate >/dev/null
check "X8 duplicate -> cancelled" yes "add-label factory:cancelled"
check "X8 duplicate closes the PR" yes "pr close 16"

# X9. In-flight builder PR on a cancelled story is closed, state stays cancelled.
setup factory/issue-5 agentbot "x"; jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:cancelled"}]}' > "$FX/issue.json"
GITHUB_OUTPUT="$WORK/out" "$SCRIPT" pr-updated 16 >/dev/null
check "X9 late PR on cancelled story is closed" yes "pr close 16"
check "X9 cancelled story stays cancelled" no "remove-label factory:cancelled|add-label factory:agent-review"
out_has cleanup_pr=16 && { pass=$((pass+1)); echo "ok   X9 preview cleanup requested"; } || { fail=$((fail+1)); echo "FAIL X9 missing cleanup output"; }

# X10. Reviews, readiness and plan notices are ignored on a cancelled story.
setup factory/issue-5 agentbot "$M
✅ APPROVED"; jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:cancelled"}]}' > "$FX/issue.json"
jq -n --arg m "$M" '[{commit_id:"sha1", user:{login:"agentbot"}, body:($m+"\n✅ APPROVED")}]' > "$FX/reviews.json"
PREVIEW_HEALTH_CMD=true "$SCRIPT" review 16 1 >/dev/null
PREVIEW_HEALTH_CMD=true "$SCRIPT" ready-check 16 >/dev/null
jq -n '[{id:12, user:{login:"agentbot"}, body:"<!-- factory:breakdown -->\nplan"}]' > "$FX/comments.json"
FACTORY_APPROVERS=alice "$SCRIPT" plan-ready 5 >/dev/null
check "X10 no transitions on a cancelled story" no "issue (edit|comment)|statuses"


# P. Story split: an approved plan with a "Proposed split" creates the parts as sub-issues.
SPLIT_PLAN='<!-- factory:breakdown -->
## Summary
Big story.
## Proposed split
<!-- factory:split -->
### Story 1: Sign in with Google
#### Story
As a user I sign in.
#### Acceptance criteria
1. Login screen.
### Story 2: Own data per account
#### Story
As a user I see only my data.
## Open questions
None'
splitfx() { # plan body -> comments fixture with one agent plan
  jq -n --arg b "$1" '[{id:12, user:{login:"agentbot"}, body:$b}]' > "$FX/comments.json"
}
setup factory/issue-5 agentbot x; splitfx "$SPLIT_PLAN"
FACTORY_APPROVERS=alice "$SCRIPT" plan-ready 5 >/dev/null
check "P1 plan-ready announces the split" yes "split this story into the 2 proposed stories"

setup factory/issue-5 agentbot x; splitfx "$SPLIT_PLAN"
jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-5.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/approve", html_url:"https://x/c"}' > "$FX/comment.json"
FACTORY_APPROVERS=alice "$SCRIPT" command 5 900 >/dev/null 2>&1
check "P2 creates part 1" yes "api -X POST repos/owner/repo/issues -f title=Sign in with Google"
check "P2 creates part 2" yes "api -X POST repos/owner/repo/issues -f title=Own data per account"
check "P2 links parts as sub-issues" yes "issues/5/sub_issues -F sub_issue_id=100000"
check "P2 parent -> split" yes "issue edit 5 .*--add-label factory:split"
check "P2 parent is not sent to the builder" no "add-label factory:plan-approved"
check "P2 first part starts its breakdown" yes "issue edit 100 .*--add-label factory:breakdown"
check "P2 second part waits" no "issue edit 101 .*--add-label factory:breakdown"
check "P2 ack" yes "Plan approved with split"

setup factory/issue-5 agentbot x; splitfx "${SPLIT_PLAN/<!-- factory:split -->/}"
jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-5.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/approve", html_url:"https://x/c"}' > "$FX/comment.json"
FACTORY_APPROVERS=alice "$SCRIPT" command 5 900 >/dev/null 2>&1
check "P3 split section without marker: no parts" no "api -X POST repos/owner/repo/issues "
check "P3 split section without marker: normal approval" yes "add-label factory:plan-approved"

partfx() { # part-number state_reason
  jq -n --arg r "$2" '{node_id:"I_p", state:"closed", state_reason:$r, user:{login:"github-actions[bot]"}, body:"<!-- factory:child-of 5 -->\n_Part_", labels:[{name:"factory:story"}]}' > "$FX/issue-$1.json"
  jq -n '{node_id:"I_5", state:"open", labels:[{name:"factory:story"},{name:"factory:split"}]}' > "$FX/issue-5.json"
}
setup factory/issue-5 agentbot x; partfx 100 completed
jq -n '{node_id:"I_n", user:{login:"github-actions[bot]"}, labels:[{name:"factory:story"}]}' > "$FX/issue-101.json"
jq -n '[{number:100, state:"closed", state_reason:"completed"}, {number:101, state:"open"}]' > "$FX/sub_issues.json"
"$SCRIPT" child-closed 100 >/dev/null
check "P4 done part starts the next part" yes "issue edit 101 .*--add-label factory:breakdown"
check "P4 parent stays open" no "issue close 5"

setup factory/issue-5 agentbot x; partfx 101 completed
jq -n '[{number:100, state:"closed", state_reason:"completed"}, {number:101, state:"closed", state_reason:"completed"}]' > "$FX/sub_issues.json"
"$SCRIPT" child-closed 101 >/dev/null
check "P5 last part closes the parent as completed" yes "issue close 5 --repo owner/repo --reason completed"

setup factory/issue-5 agentbot x; partfx 101 completed
jq '.user.login = "mallory"' "$FX/issue-101.json" > "$FX/t" && mv "$FX/t" "$FX/issue-101.json"
jq -n '[{number:101, state:"closed", state_reason:"completed"}]' > "$FX/sub_issues.json"
"$SCRIPT" child-closed 101 >/dev/null
check "P6 part marker by a stranger is ignored" no "issue (close|comment|edit)"

setup factory/issue-5 agentbot x
jq -n '{node_id:"I_5", state:"closed", labels:[{name:"factory:story"},{name:"factory:split"}]}' > "$FX/issue-5.json"
jq -n '[{number:100, state:"closed", state_reason:"completed"}, {number:101, state:"open"}]' > "$FX/sub_issues.json"
"$SCRIPT" closed 5 not_planned >/dev/null
check "P7 cancelled parent cancels its open parts" yes "issue close 101 --repo owner/repo --reason not planned"
check "P7 closed parts stay closed" no "issue close 100"


# P8. /cancel on the last open part closes the parent (close happens before child-closed).
setup factory/issue-5 agentbot x
jq -n '{node_id:"I_p", state:"open", user:{login:"github-actions[bot]", type:"Bot"}, body:"<!-- factory:child-of 40 -->\n_Part_", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-41.json"
jq -n '{node_id:"I_40", state:"open", labels:[{name:"factory:story"},{name:"factory:split"}]}' > "$FX/issue-40.json"
jq -n '[{number:41, state:"open"}]' > "$FX/sub_issues.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/cancel", html_url:"https://x/c"}' > "$FX/comment.json"
FACTORY_APPROVERS=alice "$SCRIPT" command 41 900 >/dev/null 2>&1
check "P8 /cancel on the last part closes the parent" yes "issue close 40 --repo owner/repo --reason not planned"

# P9. Nested split: the last sub-part closes its parent part, which starts the grandparent's next part.
setup factory/issue-5 agentbot x
jq -n '{node_id:"I_a", state:"closed", state_reason:"completed", user:{login:"github-actions[bot]"}, body:"<!-- factory:child-of 61 -->\n_Part_", labels:[{name:"factory:story"}]}' > "$FX/issue-70.json"
jq -n '{node_id:"I_61", state:"open", user:{login:"github-actions[bot]"}, body:"<!-- factory:child-of 60 -->\n_Part_", labels:[{name:"factory:story"},{name:"factory:split"}]}' > "$FX/issue-61.json"
jq -n '{node_id:"I_60", state:"open", labels:[{name:"factory:story"},{name:"factory:split"}]}' > "$FX/issue-60.json"
jq -n '{node_id:"I_62", user:{login:"github-actions[bot]"}, labels:[{name:"factory:story"}]}' > "$FX/issue-62.json"
jq -n '[{number:70, state:"closed", state_reason:"completed"}]' > "$FX/sub_issues-61.json"
jq -n '[{number:61, state:"open"}, {number:62, state:"open"}]' > "$FX/sub_issues-60.json"
"$SCRIPT" child-closed 70 >/dev/null 2>&1
check "P9 nested: grandparent's next part starts" yes "issue edit 62 .*--add-label factory:breakdown"


# H. Human tasks: an approved plan with "Human tasks" creates assigned sub-issues; the release waits for them.
TASK_PLAN='<!-- factory:breakdown -->
## Summary
Login.
## Human tasks
<!-- factory:human-tasks -->
### Task 1: Create the Google OAuth client
1. Open the Google Cloud console.
2. Store the secrets PILOT_GOOGLE_CLIENT_ID and PILOT_GOOGLE_CLIENT_SECRET.
## Open questions
None'
setup factory/issue-5 agentbot x; splitfx "$TASK_PLAN"
jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-5.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/approve", html_url:"https://x/c"}' > "$FX/comment.json"
FACTORY_APPROVERS=alice "$SCRIPT" command 5 900 >/dev/null 2>&1
check "H1 creates the human task" yes "api -X POST repos/owner/repo/issues -f title=Human task: Create the Google OAuth client .*labels\[\]=factory:human-task -f assignees\[\]=alice"
check "H1 links the task as sub-issue" yes "issues/5/sub_issues -F sub_issue_id=100000"
check "H1 story still goes to the builder" yes "issue edit 5 .*--add-label factory:plan-approved"
check "H1 task is not a story" no "labels\[\]=factory:story"

setup factory/issue-5 agentbot x
jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:human-review"}]}' > "$FX/issue-5.json"
jq -n '[{number:90, state:"open", labels:[{name:"factory:human-task"}]}]' > "$FX/sub_issues-5.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/approve", html_url:"https://x/c"}' > "$FX/comment.json"
FACTORY_APPROVERS=alice GITHUB_OUTPUT="$WORK/out" "$SCRIPT" command 5 900 >/dev/null 2>&1
check "H2 release on hold while a task is open" yes "Release on hold.*#90"
if grep -q '^land=true' "$WORK/out" 2>/dev/null; then fail=$((fail+1)); echo "FAIL H2 must not land"; else pass=$((pass+1)); echo "ok   H2 does not land"; fi

setup factory/issue-5 agentbot x
jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:human-review"}]}' > "$FX/issue-5.json"
jq -n '[{number:90, state:"closed", state_reason:"completed", labels:[{name:"factory:human-task"}]}]' > "$FX/sub_issues-5.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/approve", html_url:"https://x/c"}' > "$FX/comment.json"
FACTORY_APPROVERS=alice GITHUB_OUTPUT="$WORK/out" "$SCRIPT" command 5 900 >/dev/null 2>&1
if grep -q '^land=true' "$WORK/out" 2>/dev/null; then pass=$((pass+1)); echo "ok   H3 lands when all tasks are closed"; else fail=$((fail+1)); echo "FAIL H3 should land"; fi

setup factory/issue-5 agentbot x
jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:in-progress"}]}' > "$FX/issue-5.json"
jq -n '[{number:90, state:"open", labels:[{name:"factory:human-task"}]}]' > "$FX/sub_issues-5.json"
"$SCRIPT" closed 5 not_planned >/dev/null 2>&1
check "H4 cancelled story closes its open tasks" yes "issue close 90 --repo owner/repo --reason not planned"

setup factory/issue-5 agentbot x; partfx 101 completed
jq -n '[{number:100, state:"closed", state_reason:"completed"}, {number:101, state:"closed", state_reason:"completed"}, {number:91, state:"open", labels:[{name:"factory:human-task"}]}]' > "$FX/sub_issues.json"
"$SCRIPT" child-closed 101 >/dev/null 2>&1
check "H5 open human tasks do not count as open parts" yes "issue close 5 --repo owner/repo --reason completed"

setup factory/issue-5 agentbot x; splitfx "${TASK_PLAN/<!-- factory:human-tasks -->/}"
jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-5.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/approve", html_url:"https://x/c"}' > "$FX/comment.json"
FACTORY_APPROVERS=alice "$SCRIPT" command 5 900 >/dev/null 2>&1
check "H6 tasks section without marker creates nothing" no "api -X POST repos/owner/repo/issues "


# F. Follow-up tickets requested in a comment are written, created and started; the story itself is unaffected.
cat > "$WORK/bin/followup-stub" <<'STUB'
#!/usr/bin/env bash
echo "writer $(cat "$3")" >> "$CLASSIFY_LOG"
if [ -n "${FOLLOWUP_EMPTY:-}" ]; then echo '{"stories":[]}'; exit 0; fi
jq -n '{stories:[{title:"Shared household access", body:"### Story\nAs a partner I see the same properties."}]}'
STUB
chmod +x "$WORK/bin/followup-stub"
export FOLLOWUP_CMD="$WORK/bin/followup-stub"
fcmd() { # state-label body intent followup
  setup factory/issue-5 agentbot "x"; : > "$CLASSIFY_LOG"
  jq -n --arg l "$1" '{node_id:"I_test", title:"Login", body:"story", labels:([{name:"factory:story"}] + (if $l == "" then [] else [{name:$l}] end))}' > "$FX/issue-5.json"
  jq -n '{node_id:"I_100", user:{login:"github-actions[bot]"}, labels:[{name:"factory:story"}]}' > "$FX/issue-100.json"
  jq -n --arg b "$2" '{user:{login:"alice", type:"User"}, body:$b, html_url:"https://x/c"}' > "$FX/comment.json"
  CLASSIFY_INTENT="$3" CLASSIFY_FOLLOWUP="$4" GITHUB_OUTPUT="$WORK/out" "$SCRIPT" command 5 900 >/dev/null 2>&1
}
fcmd factory:plan-review "1: yes. 2: yes correct, please create a ticket for that." changes true
check "F1 follow-up story created" yes "api -X POST repos/owner/repo/issues -f title=Shared household access .*labels\[\]=factory:story"
check "F1 follow-up breakdown starts" yes "issue edit 100 .*--add-label factory:breakdown"
check "F1 parent gets the list" yes "Follow-up stories created"
check "F1 rest of the comment still handled (refined plan)" yes "issue edit 5 .*--add-label factory:breakdown"

fcmd factory:plan-review "1: yes. 2: yes, later." changes false
check "F2 no ticket without an explicit request" no "api -X POST repos/owner/repo/issues "
grep -q '^writer' "$CLASSIFY_LOG" && { fail=$((fail+1)); echo "FAIL F2 writer must not run"; } || { pass=$((pass+1)); echo "ok   F2 writer not called"; }

fcmd factory:in-progress "/followup shared household access" unclear false
check "F3 /followup works outside the gates" yes "api -X POST repos/owner/repo/issues -f title=Shared household access"
check "F3 /followup leaves the story state alone" no "issue edit 5 "
check "F3 ack" yes "Follow-up request by alice handled"
[ -s "$CLASSIFY_LOG" ] && grep -qv '^writer' "$CLASSIFY_LOG" && { fail=$((fail+1)); echo "FAIL F3 classifier must not run for /followup"; } || { pass=$((pass+1)); echo "ok   F3 no classifier for /followup"; }

fcmd factory:plan-review "/approve
/followup shared household access" unclear false
check "F4 /approve with /followup approves the plan" yes "issue edit 5 .*--add-label factory:plan-approved"
check "F4 /approve with /followup creates the ticket" yes "title=Shared household access"

setup factory/issue-5 agentbot x
jq -n '{node_id:"I_test", title:"Login", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-5.json"
jq -n '[{user:{login:"github-actions[bot]"}, body:"<!-- factory:followups 900 -->\ndone"}]' > "$FX/comments.json"
jq -n '{user:{login:"alice", type:"User"}, body:"x", html_url:"https://x/c"}' > "$FX/comment.json"
"$SCRIPT" followups 5 900 >/dev/null 2>&1
check "F5 follow-ups of a comment are created once" no "api -X POST repos/owner/repo/issues "

FOLLOWUP_EMPTY=1 fcmd factory:plan-review "please create a ticket" unclear true
check "F6 nothing written -> bot says so" yes "No follow-up story could be written"
check "F6 nothing written -> no issue" no "api -X POST repos/owner/repo/issues "


GH_FAIL_CREATE=1 fcmd factory:plan-review "/approve
/followup shared household access" unclear false
check "F7 failed follow-up does not block /approve" yes "issue edit 5 .*--add-label factory:plan-approved"
check "F7 failed follow-up is reported" yes "could not be created"

fcmd_setup_retry() {
  jq -n '[{number:77, body:"<!-- factory:followup-of 5 comment 900 part 0 -->\n### Story"}]' > "$FX/bot_issues.json"
}
setup factory/issue-5 agentbot x; fcmd_setup_retry
jq -n '{node_id:"I_test", title:"Login", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-5.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/followup x", html_url:"https://x/c"}' > "$FX/comment.json"
"$SCRIPT" followups 5 900 >/dev/null 2>&1
check "F8 retry reuses the story created before the failure" no "api -X POST repos/owner/repo/issues "
check "F8 retry lists the existing story" yes "#77 Shared household access"


# D. Dependencies (GitHub "blocked by"): planning runs, the build waits for open blockers.
dcmd() { # state-label body
  setup factory/issue-5 agentbot x
  jq -n --arg l "$1" '{node_id:"I_test", id:5000, title:"T", labels:[{name:"factory:story"},{name:$l}]}' > "$FX/issue-5.json"
  jq -n --arg b "$2" '{user:{login:"alice", type:"User"}, body:$b, html_url:"https://x/c"}' > "$FX/comment.json"
}
dcmd factory:plan-review "/approve"; jq -n '[{number:28, state:"open", state_reason:null}]' > "$FX/blocked_by-5.json"
FACTORY_APPROVERS=alice "$SCRIPT" command 5 900 >/dev/null 2>&1
check "D1 approved plan with an open blocker waits" yes "issue edit 5 .*--add-label factory:waiting"
check "D1 builder not started" no "add-label factory:plan-approved"
check "D1 status names the blocker" yes "the build waits for #28"

dcmd factory:plan-review "/approve"; jq -n '[{number:28, state:"closed", state_reason:"completed"}]' > "$FX/blocked_by-5.json"
FACTORY_APPROVERS=alice "$SCRIPT" command 5 900 >/dev/null 2>&1
check "D2 closed blocker does not hold the build" yes "issue edit 5 .*--add-label factory:plan-approved"

dunblock() { # blocker-reason other-blocker-state
  setup factory/issue-5 agentbot x
  jq -n '[{number:32, state:"open"}]' > "$FX/blocking-28.json"
  jq -n '{node_id:"I_32", labels:[{name:"factory:story"},{name:"factory:waiting"}]}' > "$FX/issue-32.json"
  jq -n --arg r "$1" --arg o "$2" '[{number:28, state:"closed", state_reason:$r}] + (if $o == "" then [] else [{number:29, state:$o, state_reason:null}] end)' > "$FX/blocked_by-32.json"
  "$SCRIPT" unblock 28 >/dev/null 2>&1
}
dunblock completed ""
check "D3 last blocker done starts the build" yes "issue edit 32 .*--add-label factory:plan-approved"
check "D3 comment" yes "All blockers are done"
dunblock not_planned ""
check "D4 cancelled blocker keeps waiting" no "issue edit 32 .*--add-label factory:plan-approved"
check "D4 asks the approvers" yes "closed without being completed"
dunblock completed open
check "D5 another open blocker keeps waiting" no "issue edit 32 "

dcmd factory:waiting "/start"; jq -n '[{number:28, state:"open", state_reason:null}]' > "$FX/blocked_by-5.json"
FACTORY_APPROVERS=alice "$SCRIPT" command 5 900 >/dev/null 2>&1
check "D6 /start builds a waiting story anyway" yes "issue edit 5 .*--add-label factory:plan-approved"

setup factory/issue-5 agentbot x
jq -n '[{number:32, state:"open"}]' > "$FX/blocking-28.json"
jq -n '{node_id:"I_32", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-32.json"
jq -n '[{number:28, state:"closed", state_reason:"completed"}]' > "$FX/blocked_by-32.json"
"$SCRIPT" unblock 28 >/dev/null 2>&1
check "D7 a story not yet approved is not started by unblock" no "issue edit 32 "

fcmd factory:in-progress "/followup shared household access" unclear false
check "D8 follow-up is blocked by its origin story" yes "issues/100/dependencies/blocked_by -F issue_id="

setup factory/issue-5 agentbot x; splitfx "$SPLIT_PLAN"
jq -n '{node_id:"I_test", id:5000, labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-5.json"
jq -n '{id:100000}' > "$FX/issue-100.json"
jq -n '[{number:9, state:"open", state_reason:null}]' > "$FX/blocked_by-5.json"
jq -n '{id:9000}' > "$FX/issue-9.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/approve", html_url:"https://x/c"}' > "$FX/comment.json"
FACTORY_APPROVERS=alice "$SCRIPT" command 5 900 >/dev/null 2>&1
check "D9 split part 2 is blocked by part 1" yes "issues/101/dependencies/blocked_by -F issue_id=100000"
check "D9 split part 1 inherits the parent's open blockers" yes "issues/100/dependencies/blocked_by -F issue_id=9000"


# D10. A closed blocker that is not a factory story (bug, human task) also releases waiting stories.
setup factory/issue-5 agentbot x
jq -n '[{number:32, state:"open"}]' > "$FX/blocking-90.json"
jq -n '{node_id:"I_32", labels:[{name:"factory:story"},{name:"factory:waiting"}]}' > "$FX/issue-32.json"
jq -n '[{number:90, state:"closed", state_reason:"completed"}]' > "$FX/blocked_by-32.json"
"$SCRIPT" unblock 90 >/dev/null 2>&1
check "D10 non-story blocker releases the waiting story" yes "issue edit 32 .*--add-label factory:plan-approved"
# The workflow must call unblock for every closed issue: stories via closed, all others directly.
WF="$ROOT/.github/workflows/factory-flow.yml"
if grep -q "!contains(github.event.issue.labels.\*.name, 'factory:story')" "$WF" && grep -q 'factory-flow.sh unblock' "$WF"; then
  pass=$((pass+1)); echo "ok   D10 workflow runs unblock for closed non-story issues"
else
  fail=$((fail+1)); echo "FAIL D10 workflow has no unblock job for closed non-story issues"
fi


# Q. Quiet mode: progress goes into the status section (edits send no email); only action requests are comments with mentions.
setup factory/issue-5 agentbot x
jq -n '{node_id:"I_test", body:"### Story\nAs a user.", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-5.json"
jq -n '[{id:12, user:{login:"agentbot"}, body:"<!-- factory:breakdown -->\nplan"}]' > "$FX/comments.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/approve", html_url:"https://x/c"}' > "$FX/comment.json"
FACTORY_APPROVERS=alice,bob "$SCRIPT" command 5 900 >/dev/null 2>&1
check "Q1 plan approval posts no comment" no "issue comment"
check "Q1 plan approval reacts on the comment" yes "comments/900/reactions -f content=\+1"
check "Q1 status names the approver without @" yes "Plan approved by alice"
check "Q1 no @mention in the status" no "^  \|.*@alice"
b=$(jq -r .body "$FX/issue-5.json")
if printf '%s' "$b" | grep -q '^### Story' && printf '%s' "$b" | grep -q '^<!-- factory:status:start -->' && printf '%s' "$b" | grep -q '^<!-- factory:status:end -->'; then pass=$((pass+1)); echo "ok   Q2 status section appended, story text kept"; else fail=$((fail+1)); echo "FAIL Q2 status section"; printf '%s\n' "$b"; fi
"$SCRIPT" status 5 "second step" >/dev/null 2>&1; "$SCRIPT" status 5 "third step" >/dev/null 2>&1
b=$(jq -r .body "$FX/issue-5.json")
n=$(printf '%s\n' "$b" | grep -c '^<!-- factory:status:start -->'); h=$(printf '%s\n' "$b" | grep -c '^- ')
if [ "$n" = 1 ] && [ "$h" = 3 ] && printf '%s' "$b" | grep -q '^\*\*Factory status\*\* .*third step'; then pass=$((pass+1)); echo "ok   Q2 one section, current line and 3 history lines"; else fail=$((fail+1)); echo "FAIL Q2 section count=$n history=$h"; printf '%s\n' "$b"; fi

setup factory/issue-5 agentbot x
jq -n '{node_id:"I_test", labels:[{name:"factory:story"},{name:"factory:plan-review"}]}' > "$FX/issue-5.json"
jq -n '[{user:{login:"github-actions[bot]"}, content:"+1"}]' > "$FX/reactions.json"
jq -n '{user:{login:"alice", type:"User"}, body:"/approve", html_url:"https://x/c"}' > "$FX/comment.json"
FACTORY_APPROVERS=alice "$SCRIPT" command 5 900 >/dev/null 2>&1
check "Q3 a comment with the bot's reaction is handled once" no "issue edit 5"

cmd factory:plan-review alice "hmm, not sure" unclear
check "Q4 unclear: the author is asked by mention" yes "^@alice Read as: unclear.*No action taken"

setup factory/issue-5 agentbot "$M
✅ APPROVED"
jq -n --arg m "$M" '[{commit_id:"sha1", user:{login:"agentbot"}, body:($m+"\n✅ APPROVED")}]' > "$FX/reviews.json"
FACTORY_APPROVERS=alice,bob PREVIEW_HEALTH_CMD=true "$SCRIPT" ready-check 16 >/dev/null 2>&1
check "Q5 test request mentions the approvers" yes "^@alice @bob$"

setup factory/issue-5 agentbot x
jq -n '[{id:12, user:{login:"agentbot"}, body:"<!-- factory:breakdown -->\nplan\n---\n**Plan ready for your review** @alice @bob"}]' > "$FX/comments.json"
FACTORY_APPROVERS=alice,bob "$SCRIPT" plan-ready 5 >/dev/null 2>&1
check "Q6 plan with mentions: no extra notice" no "issue comment"
check "Q6 plan with mentions: status marks it" yes "factory:mark plan-ready 12"
setup factory/issue-5 agentbot x
jq -n '[{id:12, user:{login:"agentbot"}, body:"<!-- factory:breakdown -->\nplan\n**Plan ready for your review** @alice"}]' > "$FX/comments.json"
FACTORY_APPROVERS=alice,bob "$SCRIPT" plan-ready 5 >/dev/null 2>&1
check "Q6 plan missing a mention: fallback notice" yes "Plan ready for your review\*\* @alice @bob"

setup factory/issue-5 agentbot "$M
⏸ INCONCLUSIVE"
FACTORY_APPROVERS=alice,bob "$SCRIPT" review 16 1 >/dev/null 2>&1
check "Q7 blocked notice mentions the approvers" yes "issue comment 5 --repo owner/repo --body @alice @bob$"
check "Q7 blocked notice text" yes "^\*\*Blocked:\*\* the reviewer agent"

setup factory/issue-5 agentbot x; partfx 100 not_planned
jq -n '{node_id:"I_n", user:{login:"github-actions[bot]"}, labels:[{name:"factory:story"}]}' > "$FX/issue-101.json"
jq -n '[{number:100, state:"closed", state_reason:"not_planned"}, {number:101, state:"open"}]' > "$FX/sub_issues.json"
FACTORY_APPROVERS=alice "$SCRIPT" child-closed 100 >/dev/null 2>&1
check "Q8 cancelled part: the next part asks the approvers" yes "issue comment 101 --repo owner/repo --body @alice$"
check "Q8 cancelled part: question text" yes "previous part #100 was closed without being completed"
check "Q8 cancelled part: the next part does not start" no "issue edit 101 .*--add-label factory:breakdown"

setup factory/issue-5 agentbot "$M
🔄 CHANGES REQUESTED"
echo '[]' > "$FX/comments.json"
jq -n '[{number:16, head:{ref:"factory/issue-5"}}]' > "$FX/open_pulls.json"
"$SCRIPT" review 16 1 >/dev/null 2>&1
check "Q9 rework with an open PR: no issue comment" no "issue comment 5"
check "Q9 rework with an open PR: reason on the PR" yes "pr comment 16"

echo "factory-flow: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
