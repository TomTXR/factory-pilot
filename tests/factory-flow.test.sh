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
if [ "$1" = "api" ]; then
  path="$2"
  case "$path" in
    */pulls/*/reviews/*) cat "$FX/review.json" ;;
    */pulls/*/reviews) cat "$FX/reviews.json" ;;
    */pulls\?*) cat "$FX/open_pulls.json" ;;
    */pulls/*) cat "$FX/pull.json" ;;
    */issues/comments/*) cat "$FX/comment.json" ;;
    */issues/*/comments) cat "$FX/comments.json" ;;
    */issues/*) if [ -f "$FX/issue.json" ]; then cat "$FX/issue.json"; else echo '{"node_id":"I_test","labels":[]}'; fi ;;
    *) echo '{}' ;;
  esac
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
  echo '[]' > "$FX/reviews.json"; echo '[]' > "$FX/comments.json"; rm -f "$FX/issue.json" "$FX/comment.json" "$WORK/out"
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
echo "$1" >> "$CLASSIFY_LOG"; printf '{"intent":"%s","summary":"stub"}\n' "$CLASSIFY_INTENT"
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
check "C2 acknowledged" yes "factory:ack 900"

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
jq -n '{node_id:"I_test", user:{login:"mallory"}, labels:[{name:"factory:story"}]}' > "$FX/issue.json"; : > "$GH_LOG"
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
check "X7 reopened explains /start" yes "factory:reopened"

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

echo "factory-flow: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
