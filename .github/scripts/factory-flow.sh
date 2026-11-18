#!/usr/bin/env bash
# Deterministic state transitions of the factory between agent steps.
# Labels set here with GITHUB_TOKEN trigger no workflows, so every transition
# that must happen next is done inline (rework, board updates).
#
# Trust model (public repository: anyone can review or comment):
#   - a review verdict counts only if its author is in FACTORY_AGENT_LOGINS and
#     its body carries the OpenHands review marker;
#   - factory marker comments count only if posted by FACTORY_BOT_LOGIN
#     (github-actions[bot], i.e. this automation).
#
# Usage:
#   factory-flow.sh pr-updated <pr>          factory PR opened or pushed
#   factory-flow.sh review <pr> <review-id>  a review was published
#   factory-flow.sh rework <issue> <reason>  changes requested (agent or approver)
#
# The builder automation revises an open PR on factory/issue-<n> when the
# commit status software-factory/review on its head is failure/error. This
# script sets that status; it never restarts the builder while a PR is open.
#   factory-flow.sh ready-check <pr>         preview deployed: ready for human?
# Env: GH_TOKEN, GITHUB_REPOSITORY, FACTORY_AGENT_LOGINS (comma list),
#      optional FACTORY_BOT_LOGIN, PROJECT_TOKEN, PROJECT_LOGIN, PROJECT_NUMBER,
#      PREVIEW_HEALTH_CMD (tests only)
set -euo pipefail
R="$GITHUB_REPOSITORY"
DOMAIN=domigo.com
MAX_REWORK=3
BOT="${FACTORY_BOT_LOGIN:-github-actions[bot]}"
AGENTS="${FACTORY_AGENT_LOGINS:-}"
REVIEW_MARKER='<!-- openhands-review-run:'
STATE_LABELS="factory:breakdown factory:plan-review factory:plan-approved factory:in-progress factory:agent-review factory:human-review factory:rework factory:approved-for-production factory:deploying factory:blocked"
here="$(cd "$(dirname "$0")" && pwd)"

board() { "$here/board-status.sh" "$(gh api "repos/$R/issues/$1" | jq -r .node_id)" "$2" || echo "::warning::board update failed"; }
set_state() { # issue new-label: remove every other factory state label
  local issue="$1" new="$2" old
  for old in $STATE_LABELS; do
    [ "$old" = "$new" ] && continue
    gh issue edit "$issue" --repo "$R" --remove-label "$old" >/dev/null 2>&1 || true
  done
  gh issue edit "$issue" --repo "$R" --add-label "$new" >/dev/null
}
issue_of_pr() { # factory/issue-<n>[-k] -> n
  gh api "repos/$R/pulls/$1" | jq -r .head.ref | sed -nE 's#^factory/issue-([0-9]+)(-[0-9]+)?$#\1#p'
}
is_agent() { echo ",$AGENTS," | grep -qi ",$1,"; }
bot_comments() { # issue -> JSON array of comment bodies written by this automation
  gh api "repos/$R/issues/$1/comments" --paginate | jq -s --arg bot "$BOT" '[.[][] | select(.user.login == $bot) | .body]'
}
review_status() { # sha state description
  gh api -X POST "repos/$R/statuses/$1" -f state="$2" -f context=software-factory/review -f description="$3" >/dev/null
}
open_factory_prs() { # issue -> PR numbers on factory/issue-<n> (builder's branch)
  gh api "repos/$R/pulls?state=open&per_page=100" | jq -r --arg ref "factory/issue-$1" '.[] | select(.head.ref == $ref) | .number'
}
verdict_of() { printf '%s' "$1" | grep -oE '(✅ APPROVED|🔄 CHANGES REQUESTED|⏸ INCONCLUSIVE)' | tail -1 || true; }
preview_healthy() {
  if [ -n "${PREVIEW_HEALTH_CMD:-}" ]; then $PREVIEW_HEALTH_CMD "$1"; return; fi
  curl -fsS -m 10 "https://$1/api/health" 2>/dev/null | grep -q '"status":"ok"'
}

cmd="${1:-}"; shift || true
if [ -z "$AGENTS" ] && { [ "$cmd" = review ] || [ "$cmd" = ready-check ]; }; then
  # Without the agent list no review can count; fail loudly instead of silently stalling.
  echo "::error::FACTORY_AGENT_LOGINS is empty; cannot evaluate agent reviews" >&2; exit 1
fi
case "$cmd" in
  pr-updated)
    pr="$1"; issue=$(issue_of_pr "$pr"); [ -n "$issue" ] || { echo "not a factory PR"; exit 0; }
    gh pr edit "$pr" --repo "$R" --add-label factory:agent-review >/dev/null
    set_state "$issue" factory:agent-review; board "$issue" "Agent Review"
    echo "issue #$issue -> agent review (PR #$pr)"
    ;;

  review)
    pr="$1"; rid="$2"; issue=$(issue_of_pr "$pr"); [ -n "$issue" ] || { echo "not a factory PR"; exit 0; }
    review=$(gh api "repos/$R/pulls/$pr/reviews/$rid")
    author=$(echo "$review" | jq -r .user.login); body=$(echo "$review" | jq -r .body); url=$(echo "$review" | jq -r .html_url)
    if ! is_agent "$author" || ! printf '%s' "$body" | grep -qF "$REVIEW_MARKER"; then
      echo "ignored: review $rid by $author is not a factory agent review"; exit 0
    fi
    verdict=$(verdict_of "$body")
    echo "review $rid on PR #$pr by $author: ${verdict:-no verdict}"
    case "$verdict" in
      "🔄 CHANGES REQUESTED")
        reason=$(printf 'The reviewer agent requested changes on PR #%s: %s\n\n<details><summary>Review</summary>\n\n%s\n\n</details>' "$pr" "$url" "$body")
        "$0" rework "$issue" "$reason" ;;
      "✅ APPROVED")
        review_status "$(gh api "repos/$R/pulls/$pr" | jq -r .head.sha)" success "Reviewer agent approved"
        "$0" ready-check "$pr" ;;
      "⏸ INCONCLUSIVE")
        set_state "$issue" factory:blocked; board "$issue" Blocked
        gh issue comment "$issue" --repo "$R" --body "Blocked: the reviewer agent could not reach a verdict on PR #$pr ($url). A human must decide." >/dev/null ;;
      *) echo "no verdict marker, nothing to do" ;;
    esac
    ;;

  rework)
    issue="$1"; reason="$2"
    n=$(bot_comments "$issue" | jq '[.[] | select(contains("<!-- factory:rework -->"))] | length')
    if [ "$n" -ge "$MAX_REWORK" ]; then
      for pr in $(open_factory_prs "$issue"); do review_status "$(gh api "repos/$R/pulls/$pr" | jq -r .head.sha)" pending "Blocked: rework limit reached"; done
      set_state "$issue" factory:blocked; board "$issue" Blocked
      gh issue comment "$issue" --repo "$R" --body "Blocked: $n rework loops reached the limit of $MAX_REWORK. A human must decide how to continue." >/dev/null
      echo "issue #$issue -> blocked (rework limit)"; exit 0
    fi
    prs=$(open_factory_prs "$issue")
    if [ -n "$prs" ]; then
      # Revise the open PR: the builder picks it up when the review status is failure.
      for pr in $prs; do
        gh pr comment "$pr" --repo "$R" --body "$(printf '<!-- factory:rework -->\n**Changes requested (rework %s of %s).** Address this in this PR:\n\n%s' "$((n+1))" "$MAX_REWORK" "$reason")" >/dev/null
        review_status "$(gh api "repos/$R/pulls/$pr" | jq -r .head.sha)" failure "Changes requested (rework $((n+1)) of $MAX_REWORK)"
      done
      gh issue comment "$issue" --repo "$R" --body "$(printf '<!-- factory:rework -->\n**Rework %s of %s.** The builder revises PR #%s.\n\n%s' "$((n+1))" "$MAX_REWORK" "$(echo $prs | tr ' ' ',')" "$reason")" >/dev/null
      set_state "$issue" factory:rework; board "$issue" Rework
      echo "issue #$issue -> rework $((n+1)), builder revises PR $prs"; exit 0
    fi
    # No open PR (e.g. the builder judged the story unclear): start the builder again.
    gh issue comment "$issue" --repo "$R" --body "$(printf '<!-- factory:rework -->\n**Rework %s of %s.** No open PR; the builder starts again from `main` and reads this thread.\n\n%s' "$((n+1))" "$MAX_REWORK" "$reason")" >/dev/null
    set_state "$issue" factory:plan-approved; board "$issue" "In Progress"
    echo "issue #$issue -> rework $((n+1)), builder re-triggered"
    ;;

  ready-check)
    pr="$1"; issue=$(issue_of_pr "$pr"); [ -n "$issue" ] || { echo "not a factory PR"; exit 0; }
    prj=$(gh api "repos/$R/pulls/$pr")
    [ "$(echo "$prj" | jq -r .state)" = "open" ] || { echo "PR closed"; exit 0; }
    head=$(echo "$prj" | jq -r .head.sha)
    last_agent_body=$(gh api "repos/$R/pulls/$pr/reviews" --paginate | jq -rs --arg head "$head" --arg agents ",$AGENTS," --arg m "$REVIEW_MARKER" \
      '[.[][] | (.user.login | ascii_downcase) as $u | select(.commit_id == $head and ($agents | ascii_downcase | contains("," + $u + ",")) and (.body | contains($m)))] | last | .body // ""')
    host="pilot-pr-$pr.$DOMAIN"
    approved=no; [ "$(verdict_of "$last_agent_body")" = "✅ APPROVED" ] && approved=yes
    healthy=no; preview_healthy "$host" && healthy=yes
    echo "PR #$pr head ${head:0:7}: agent approved=$approved preview healthy=$healthy"
    [ "$approved" = yes ] && [ "$healthy" = yes ] || exit 0
    marker="<!-- factory:test-request $head -->"
    if bot_comments "$issue" | jq -e --arg m "$marker" 'any(.[]; contains($m))' >/dev/null; then echo "test request already posted"; exit 0; fi
    set_state "$issue" factory:human-review; board "$issue" "Human Review"
    gh issue comment "$issue" --repo "$R" --body "$(printf '%s\n## Test request\n\nThe change for this story is ready for your review.\n\n- **Test version:** https://%s\n- **Pull request:** #%s (commit %s), CI green, reviewer agent approved\n\nPlease check the acceptance criteria of this issue on the test version (also on your phone). Then set one label:\n\n- `factory:approved-for-production` to merge and deploy, or\n- `factory:rework` and add a comment with what must change.' "$marker" "$host" "$pr" "${head:0:7}")" >/dev/null
    echo "issue #$issue -> human review"
    ;;

  *) echo "usage: $0 pr-updated|review|rework|ready-check ..." >&2; exit 2 ;;
esac
