#!/usr/bin/env bash
# Deterministic state transitions of the factory between agent steps.
# Labels set here with GITHUB_TOKEN trigger no workflows, so every transition
# that must happen next is done inline (rework, board updates).
#
# Usage:
#   factory-flow.sh pr-updated <pr>          factory PR opened or pushed
#   factory-flow.sh review <pr> <review-id>  reviewer agent published a review
#   factory-flow.sh rework <issue> <reason>  human or reviewer requested changes
#   factory-flow.sh ready-check <pr>         preview deployed: ready for human?
# Env: GH_TOKEN, GITHUB_REPOSITORY, PROJECT_TOKEN, PROJECT_LOGIN, PROJECT_NUMBER
set -euo pipefail
R="$GITHUB_REPOSITORY"
DOMAIN=domigo.com
MAX_REWORK=3
here="$(cd "$(dirname "$0")" && pwd)"

board() { "$here/board-status.sh" "$(gh api "repos/$R/issues/$1" --jq .node_id)" "$2" || echo "::warning::board update failed"; }
set_state() { # issue new-label
  local issue="$1" new="$2" old
  for old in factory:plan-approved factory:in-progress factory:agent-review factory:human-review factory:rework; do
    [ "$old" = "$new" ] && continue
    gh issue edit "$issue" --repo "$R" --remove-label "$old" >/dev/null 2>&1 || true
  done
  gh issue edit "$issue" --repo "$R" --add-label "$new" >/dev/null
}
issue_of_pr() { # factory/issue-<n>[-k] -> n
  gh pr view "$1" --repo "$R" --json headRefName --jq .headRefName | sed -nE 's#^factory/issue-([0-9]+)(-[0-9]+)?$#\1#p'
}

cmd="${1:-}"; shift || true
case "$cmd" in
  pr-updated)
    pr="$1"; issue=$(issue_of_pr "$pr"); [ -n "$issue" ] || { echo "not a factory PR"; exit 0; }
    gh pr edit "$pr" --repo "$R" --add-label factory:agent-review >/dev/null
    set_state "$issue" factory:agent-review; board "$issue" "Agent Review"
    echo "issue #$issue -> agent review (PR #$pr)"
    ;;

  review)
    pr="$1"; rid="$2"; issue=$(issue_of_pr "$pr"); [ -n "$issue" ] || { echo "not a factory PR"; exit 0; }
    body=$(gh api "repos/$R/pulls/$pr/reviews/$rid" --jq .body)
    url=$(gh api "repos/$R/pulls/$pr/reviews/$rid" --jq .html_url)
    verdict=$(printf '%s' "$body" | grep -oE '(✅ APPROVED|🔄 CHANGES REQUESTED|⏸ INCONCLUSIVE)' | tail -1 || true)
    echo "review $rid on PR #$pr: ${verdict:-no verdict}"
    case "$verdict" in
      "🔄 CHANGES REQUESTED")
        reason=$(printf 'The reviewer agent requested changes on PR #%s: %s\n\n<details><summary>Review</summary>\n\n%s\n\n</details>' "$pr" "$url" "$body")
        "$0" rework "$issue" "$reason" ;;
      "✅ APPROVED") "$0" ready-check "$pr" ;;
      "⏸ INCONCLUSIVE")
        set_state "$issue" factory:blocked; board "$issue" Blocked
        gh issue comment "$issue" --repo "$R" --body "Blocked: the reviewer agent could not reach a verdict on PR #$pr ($url). A human must decide." >/dev/null ;;
      *) echo "no verdict marker, nothing to do" ;;
    esac
    ;;

  rework)
    issue="$1"; reason="$2"
    n=$(gh api "repos/$R/issues/$issue/comments" --paginate --jq '[.[] | select(.body | contains("<!-- factory:rework -->"))] | length' | awk '{s+=$1} END {print s+0}')
    if [ "$n" -ge "$MAX_REWORK" ]; then
      set_state "$issue" factory:blocked; board "$issue" Blocked
      gh issue comment "$issue" --repo "$R" --body "Blocked: $n rework loops reached the limit of $MAX_REWORK. A human must decide how to continue." >/dev/null
      exit 0
    fi
    for pr in $(gh pr list --repo "$R" --state open --json number,headRefName --jq ".[] | select(.headRefName | test(\"^factory/issue-$issue(-[0-9]+)?$\")) | .number"); do
      gh pr close "$pr" --repo "$R" --comment "Superseded: rework requested on #$issue. The builder starts a fresh attempt." >/dev/null
    done
    gh issue comment "$issue" --repo "$R" --body "$(printf '<!-- factory:rework -->\n**Rework %s of %s.** The builder starts a fresh attempt from `main` and reads this thread.\n\n%s' "$((n+1))" "$MAX_REWORK" "$reason")" >/dev/null
    set_state "$issue" factory:plan-approved; board "$issue" "In Progress"
    echo "issue #$issue -> rework $((n+1)), builder re-triggered"
    ;;

  ready-check)
    pr="$1"; issue=$(issue_of_pr "$pr"); [ -n "$issue" ] || { echo "not a factory PR"; exit 0; }
    [ "$(gh pr view "$pr" --repo "$R" --json state --jq .state)" = "OPEN" ] || { echo "PR closed"; exit 0; }
    head=$(gh pr view "$pr" --repo "$R" --json headRefOid --jq .headRefOid)
    approved=$(gh api "repos/$R/pulls/$pr/reviews" --jq "[.[] | select(.commit_id==\"$head\") | .body] | last // \"\"" | grep -c '✅ APPROVED' || true)
    host="pilot-pr-$pr.$DOMAIN"
    healthy=$(curl -fsS -m 10 "https://$host/api/health" 2>/dev/null | grep -c '"status":"ok"' || true)
    echo "PR #$pr head ${head:0:7}: approved=$approved preview=$healthy"
    [ "$approved" -ge 1 ] && [ "$healthy" -ge 1 ] || exit 0
    marker="<!-- factory:test-request $head -->"
    if gh api "repos/$R/issues/$issue/comments" --paginate --jq '.[].body' | grep -qF "$marker"; then echo "test request already posted"; exit 0; fi
    set_state "$issue" factory:human-review; board "$issue" "Human Review"
    gh issue comment "$issue" --repo "$R" --body "$(printf '%s\n## Test request\n\nThe change for this story is ready for your review.\n\n- **Test version:** https://%s\n- **Pull request:** #%s (commit %s), CI green, reviewer agent approved\n\nPlease check the acceptance criteria of this issue on the test version (also on your phone). Then set one label:\n\n- `factory:approved-for-production` to merge and deploy, or\n- `factory:rework` and add a comment with what must change.' "$marker" "$host" "$pr" "${head:0:7}")" >/dev/null
    echo "issue #$issue -> human review"
    ;;

  *) echo "usage: $0 pr-updated|review|rework|ready-check ..." >&2; exit 2 ;;
esac
