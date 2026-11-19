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
#   factory-flow.sh plan-ready <issue>       breakdown posted a plan: notify approvers
#   factory-flow.sh start <issue>            new story: start the breakdown
#   factory-flow.sh command <issue> <id>     a comment by a human on a story issue
#   factory-flow.sh closed <issue> <reason>  issue closed (completed | not_planned | duplicate)
#   factory-flow.sh reopened <issue>         issue reopened
#   factory-flow.sh split <issue> <approver> approved plan proposes a split: create the parts
#   factory-flow.sh child-closed <issue>     a part of a split story was closed: start the next
#                                            part, or close the parent when all parts are closed
#   factory-flow.sh create-tasks <issue> <assignee>  approved plan lists human tasks: create them
#
# Human tasks (accounts, external consoles, credentials) are sub-issues labelled
# factory:human-task, assigned to the approver. A release needs all of them closed.
#
# Humans steer only with comments: /approve, /changes <text>, /retry, or plain
# text whose intent classify-intent.sh infers at the two gates. Production
# releases always need an explicit /approve. Labels are factory-managed state.
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
STATE_LABELS="factory:breakdown factory:plan-review factory:plan-approved factory:in-progress factory:agent-review factory:human-review factory:rework factory:approved-for-production factory:deploying factory:blocked factory:split factory:done factory:cancelled"
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
current_state() { # issue -> one factory state (without factory: prefix), or inbox
  local labels; labels=$(gh api "repos/$R/issues/$1" | jq -r '[.labels[].name] | join(" ")')
  for st in cancelled done split blocked approved-for-production deploying human-review agent-review rework plan-approved in-progress plan-review breakdown; do
    case " $labels " in *" factory:$st "*) echo "$st"; return;; esac
  done
  echo inbox
}
plan_body() { # issue -> body of the latest plan comment by an agent
  gh api "repos/$R/issues/$1/comments" --paginate | jq -rs --arg agents ",$AGENTS," \
    '[.[][] | (.user.login | ascii_downcase) as $u | select(($agents | ascii_downcase | contains("," + $u + ",")) and (.body | startswith("<!-- factory:breakdown -->")))] | last | .body // ""' \
    | tr -d '\r'
}
plan_questions() { plan_body "$1" | sed -n '/^## Open questions/,$p'; }
plan_blocks() { # issue dir section marker word -> dir/<k>.title, dir/<k>.body per "### <word> <k>: <title>"; prints the count
  # Only a "## <section>" with its marker line counts.
  plan_body "$1" | awk -v d="$2" -v sec="## $3" -v mk="$4" -v bw="### $5 " '
    index($0, sec) == 1 { insec = 1; next }
    insec && /^## / { insec = 0 }
    !insec { next }
    index($0, mk) == 1 { marked = 1; next }
    index($0, bw) == 1 && $0 ~ /^### [A-Za-z]+ [0-9]+:/ { k++; t = $0; sub(/^### [A-Za-z]+ [0-9]+:[ \t]*/, "", t); print t > (d "/" k ".title"); next }
    k { print > (d "/" k ".body") }
    END { print (marked ? k + 0 : 0) }'
}
split_parts() { # issue dir -> proposed stories of the plan; a split needs 2 or more
  local n; n=$(plan_blocks "$1" "$2" "Proposed split" "<!-- factory:split -->" Story)
  [ "$n" -ge 2 ] && echo "$n" || echo 0
}
plan_tasks() { plan_blocks "$1" "$2" "Human tasks" "<!-- factory:human-tasks -->" Task; }
open_parts() { # parent issue -> open sub-issue numbers that are stories (not human tasks), in order
  gh api "repos/$R/issues/$1/sub_issues?per_page=100" | jq -r '.[] | select(.state == "open" and (([.labels[]?.name] | index("factory:human-task")) | not)) | .number'
}
open_tasks() { # story -> open human-task sub-issue numbers
  gh api "repos/$R/issues/$1/sub_issues?per_page=100" | jq -r '.[] | select(.state == "open" and ([.labels[]?.name] | index("factory:human-task"))) | .number'
}
ack() { # issue comment-id text: one bot reply per human comment
  gh issue comment "$1" --repo "$R" --body "$(printf '<!-- factory:ack %s -->\n%s' "$2" "$3")" >/dev/null
}
is_approver() { echo ",${FACTORY_APPROVERS:-}," | grep -qi ",$1,"; }
emit() { [ -n "${GITHUB_OUTPUT:-}" ] && echo "$1" >> "$GITHUB_OUTPUT"; echo "output: $1"; }
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
    case "$(current_state "$issue")" in
      cancelled)
        # Agent work that was in flight when the story was cancelled: stop it here.
        gh pr close "$pr" --repo "$R" --comment "Closed: story #$issue was cancelled." >/dev/null
        emit "cleanup_pr=$pr"
        echo "issue #$issue is cancelled: closed PR #$pr"; exit 0 ;;
      done) echo "issue #$issue is done: no state change"; exit 0 ;;
    esac
    gh pr edit "$pr" --repo "$R" --add-label factory:agent-review >/dev/null
    set_state "$issue" factory:agent-review; board "$issue" "Agent Review"
    echo "issue #$issue -> agent review (PR #$pr)"
    ;;

  review)
    pr="$1"; rid="$2"; issue=$(issue_of_pr "$pr"); [ -n "$issue" ] || { echo "not a factory PR"; exit 0; }
    case "$(current_state "$issue")" in cancelled|done) echo "issue #$issue is closed: ignored"; exit 0 ;; esac
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
    case "$(current_state "$issue")" in cancelled|done) echo "issue #$issue is closed: ignored"; exit 0 ;; esac
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
    tasks=$(open_tasks "$issue" | sed 's/^/#/' | paste -sd' ' -)
    [ -n "$tasks" ] && tasks="- **Open human tasks:** $tasks (close them when done; the release waits for them)"$'\n'
    gh issue comment "$issue" --repo "$R" --body "$(printf '%s\n## Test request\n\nThe change for this story is ready for your review.\n\n- **Test version:** https://%s\n- **Pull request:** #%s (commit %s), CI green, reviewer agent approved\n%s\nPlease check the acceptance criteria of this issue on the test version (also on your phone). Then reply with a comment:\n\n- describe what must change (or `/changes <what>`): the builder revises the pull request, or\n- `/approve` to merge and deploy to production. A release always needs the explicit `/approve`.' "$marker" "$host" "$pr" "${head:0:7}" "$tasks")" >/dev/null
    echo "issue #$issue -> human review"
    ;;

  plan-ready)
    # Agent actions run as the operator account, which GitHub never notifies about
    # its own actions. A comment by this automation with an @mention does notify.
    issue="$1"
    case "$(current_state "$issue")" in cancelled|done) echo "issue #$issue is closed: ignored"; exit 0 ;; esac
    plan_id=$(gh api "repos/$R/issues/$issue/comments" --paginate | jq -rs --arg agents ",$AGENTS," \
      '[.[][] | (.user.login | ascii_downcase) as $u | select(($agents | ascii_downcase | contains("," + $u + ",")) and (.body | startswith("<!-- factory:breakdown -->")))] | last | .id // empty')
    [ -n "$plan_id" ] || { echo "no plan comment by an agent yet"; exit 0; }
    marker="<!-- factory:plan-ready $plan_id -->"
    if bot_comments "$issue" | jq -e --arg m "$marker" 'any(.[]; contains($m))' >/dev/null; then echo "already notified"; exit 0; fi
    mentions=$(echo "${FACTORY_APPROVERS:-}" | tr ',' '\n' | sed '/^$/d; s/^/@/' | paste -sd' ' -)
    if [ -z "$mentions" ]; then
      # Without approvers the notification would reach nobody; fail before writing the marker.
      echo "::error::FACTORY_APPROVERS is empty; cannot notify approvers" >&2; exit 1
    fi
    dir=$(mktemp -d); parts=$(split_parts "$issue" "$dir"); rm -rf "$dir"
    approve_text='`/approve` (or write that the plan is fine) to start building.'
    if [ "$parts" -ge 2 ]; then
      approve_text="\`/approve\` (or write that the plan is fine) to split this story into the $parts proposed stories. The factory creates them as sub-issues; each gets its own plan, and they are built one after another. To keep one story, ask for a plan without the split."
    fi
    gh issue comment "$issue" --repo "$R" --body "$(printf '%s\n**Plan ready for your review** %s\n\nPlease read the plan above. Reply with a comment:\n\n- answer the open questions and/or describe changes: the agent writes a refined plan, or\n- %s' "$marker" "$mentions" "$approve_text")" >/dev/null
    echo "issue #$issue: approvers notified (plan comment $plan_id)"
    ;;

  start)
    issue="$1"
    [ "$(current_state "$issue")" = inbox ] || { echo "issue #$issue already in progress"; exit 0; }
    # Public repo: only stories by approvers start on their own. Others wait in the
    # inbox until an approver comments /approve (the command path sets FACTORY_START_APPROVED).
    opener=$(gh api "repos/$R/issues/$issue" | jq -r .user.login)
    if [ "${FACTORY_START_APPROVED:-}" != 1 ] && ! is_approver "$opener"; then
      echo "issue #$issue by $opener waits for an approver"; exit 0
    fi
    set_state "$issue" factory:breakdown; board "$issue" Breakdown
    gh issue comment "$issue" --repo "$R" --body "$(printf '<!-- factory:started -->\n**Breakdown started.** The breakdown agent writes a plan with acceptance criteria and questions within about 5 minutes. You will be notified when it is ready.')" >/dev/null
    echo "issue #$issue -> breakdown"
    ;;

  command)
    issue="$1"; cid="$2"
    c=$(gh api "repos/$R/issues/comments/$cid")
    author=$(echo "$c" | jq -r .user.login); body=$(echo "$c" | jq -r .body); curl_url=$(echo "$c" | jq -r .html_url)
    if ! is_approver "$author" || [ "$(echo "$c" | jq -r .user.type)" != "User" ]; then echo "ignored: $author is not an approver"; exit 0; fi
    if bot_comments "$issue" | jq -e --arg m "<!-- factory:ack $cid -->" 'any(.[]; contains($m))' >/dev/null; then echo "already handled"; exit 0; fi
    state=$(current_state "$issue")
    cmd_line=$(printf '%s\n' "$body" | grep -ioE '^[[:space:]]*/(approve|changes|retry|start|cancel)\b' | head -1 | tr -d '[:space:]' | tr 'A-Z' 'a-z' || true)
    explicit=yes; intent=""; summary=""
    case "$cmd_line" in
      /approve|/start) intent=approve ;;
      /changes) intent=changes ;;
      /retry) intent=retry ;;
      /cancel) intent=cancel ;;
      *) explicit=no ;;
    esac
    echo "comment $cid by $author in state $state: command=${cmd_line:-none}"
    if [ "$explicit" = no ]; then
      case "$state" in
        plan-review|human-review)
          tmp=$(mktemp); ctx=$(mktemp); printf '%s' "$body" > "$tmp"
          [ "$state" = plan-review ] && plan_questions "$issue" > "$ctx"
          res=$("$here/classify-intent.sh" "$state" "$tmp" "$ctx"); rm -f "$tmp" "$ctx"
          intent=$(echo "$res" | jq -r .intent); summary=$(echo "$res" | jq -r .summary)
          echo "inferred: $intent ($summary)" ;;
        *) echo "plain comment outside a gate: no action"; exit 0 ;;
      esac
    fi
    read_as=""; [ "$explicit" = no ] && read_as="Read as: **$intent** - $summary"$'\n\n'
    case "$state:$intent" in
      inbox:approve|inbox:changes)
        FACTORY_START_APPROVED=1 "$0" start "$issue" >/dev/null
        ack "$issue" "$cid" "Breakdown started by @$author." ;;
      plan-review:approve)
        dir=$(mktemp -d); parts=$(split_parts "$issue" "$dir"); rm -rf "$dir"
        if [ "$parts" -ge 2 ]; then
          "$0" split "$issue" "$author"
          ack "$issue" "$cid" "${read_as}**Plan approved with split** by @$author. The story is split into $parts stories (see above)."
        else
          tasks_note=""
          dir=$(mktemp -d); ntasks=$(plan_tasks "$issue" "$dir"); rm -rf "$dir"
          if [ "$ntasks" -ge 1 ]; then
            "$0" create-tasks "$issue" "$author"
            tasks_note=" $ntasks human task(s) were created and assigned to you (see above); the release waits for them."
          fi
          set_state "$issue" factory:plan-approved; board "$issue" "In Progress"
          ack "$issue" "$cid" "${read_as}**Plan approved** by @$author. The builder starts within about 5 minutes.$tasks_note"
        fi ;;
      plan-review:changes)
        set_state "$issue" factory:breakdown; board "$issue" Breakdown
        ack "$issue" "$cid" "${read_as}**Plan changes requested** by @$author. The breakdown agent writes a refined plan that includes your comment, within about 5 minutes." ;;
      human-review:approve)
        tasks=$(open_tasks "$issue" | sed 's/^/#/' | paste -sd' ' -)
        if [ "$explicit" = yes ] && [ -n "$tasks" ]; then
          ack "$issue" "$cid" "**Release on hold.** These human tasks are still open: $tasks. Close each one when it is done, then reply \`/approve\` again."
        elif [ "$explicit" = yes ]; then
          set_state "$issue" factory:approved-for-production; board "$issue" Deploying
          ack "$issue" "$cid" "**Release approved** by @$author. Merging and deploying to production; this issue moves to Done after the smoke check."
          emit land=true
        else
          ack "$issue" "$cid" "${read_as}A release to production needs an explicit decision. Reply \`/approve\` to merge and deploy, or \`/changes <what>\` to request changes."
        fi ;;
      human-review:changes)
        ack "$issue" "$cid" "${read_as}**Changes requested** by @$author. The builder revises the pull request."
        "$0" rework "$issue" "$(printf 'Changes requested by @%s (%s):\n\n> %s' "$author" "$curl_url" "$(printf '%s' "$body" | sed 's/^/> /' | tail -c 3000)")" ;;
      blocked:retry)
        prs=$(open_factory_prs "$issue")
        if [ -n "$prs" ]; then
          for pr in $prs; do review_status "$(gh api "repos/$R/pulls/$pr" | jq -r .head.sha)" failure "Retry requested by $author"; done
          set_state "$issue" factory:rework; board "$issue" Rework
          ack "$issue" "$cid" "**Retry** by @$author. The builder revises PR $(echo $prs | tr ' ' ',') and reads this thread."
        elif [ "$(gh api "repos/$R/issues/$issue/comments" --paginate | jq -s --arg agents ",$AGENTS," '[.[][] | (.user.login | ascii_downcase) as $u | select(($agents | ascii_downcase | contains("," + $u + ",")) and (.body | startswith("<!-- factory:breakdown -->")))] | length')" -gt 0 ]; then
          set_state "$issue" factory:plan-approved; board "$issue" "In Progress"
          ack "$issue" "$cid" "**Retry** by @$author. The builder starts again from the approved plan."
        else
          set_state "$issue" factory:breakdown; board "$issue" Breakdown
          ack "$issue" "$cid" "**Retry** by @$author. The breakdown agent starts again."
        fi ;;
      done:cancel|cancelled:cancel)
        ack "$issue" "$cid" "This story is already closed (**$state**)." ;;
      *:cancel)
        if [ "$explicit" = yes ]; then
          ack "$issue" "$cid" "**Story cancelled** by @$author. Open pull requests are closed and previews removed."
          # Close first: closed -> child-closed must see this issue as closed.
          gh issue close "$issue" --repo "$R" --reason "not planned" >/dev/null
          "$0" closed "$issue" not_planned
        else
          ack "$issue" "$cid" "${read_as}Cancelling a story needs an explicit decision. Reply \`/cancel\` to close it as not planned, or \`/changes <what>\` to change it."
        fi ;;
      plan-review:unclear|human-review:unclear)
        ack "$issue" "$cid" "${read_as}No action taken. Reply \`/approve\` to proceed or \`/changes <what>\` to request changes." ;;
      *)
        if [ "$explicit" = yes ]; then
          ack "$issue" "$cid" "\`$cmd_line\` has no effect in the current state (**$state**). Commands apply at Plan Review and Human Review; \`/retry\` applies when a story is blocked."
        fi ;;
    esac
    ;;

  closed)
    # A story was closed by anyone. not_planned: cancelled, stop all work.
    # completed without the factory's deploy: show it as done.
    issue="$1"; reason="${2:-completed}"
    state=$(current_state "$issue")
    if [ "$reason" = not_planned ] || [ "$reason" = duplicate ]; then
      if [ "$state" = cancelled ]; then
        echo "issue #$issue already cancelled"
      else
        prs=$(open_factory_prs "$issue")
        for pr in $prs; do
          gh pr close "$pr" --repo "$R" --comment "Closed: story #$issue was cancelled." >/dev/null
          emit "cleanup_pr=$pr"
        done
        set_state "$issue" factory:cancelled; board "$issue" Cancelled
        echo "issue #$issue -> cancelled (closed PRs: ${prs:-none})"
        for task in $(open_tasks "$issue"); do
          gh issue close "$task" --repo "$R" --reason "not planned" --comment "Closed: story #$issue was cancelled." >/dev/null
        done
        if [ "$state" = split ]; then
          # A cancelled split story cancels its open parts (closing by GITHUB_TOKEN triggers no event).
          for part in $(open_parts "$issue"); do
            gh issue close "$part" --repo "$R" --reason "not planned" --comment "Closed: parent story #$issue was cancelled." >/dev/null
            "$0" closed "$part" not_planned
          done
        fi
      fi
    else
      if [ "$state" = done ]; then
        echo "issue #$issue already done"
      else
        for old in $STATE_LABELS; do gh issue edit "$issue" --repo "$R" --remove-label "$old" >/dev/null 2>&1 || true; done
        board "$issue" Done
        echo "issue #$issue closed as completed -> board Done"
      fi
    fi
    "$0" child-closed "$issue"
    ;;

  split)
    # Runs only after an approver approved a plan with a "Proposed split" section.
    issue="$1"; author="$2"
    if bot_comments "$issue" | jq -e 'any(.[]; contains("<!-- factory:split-done -->"))' >/dev/null; then echo "issue #$issue already split"; exit 0; fi
    dir=$(mktemp -d); n=$(split_parts "$issue" "$dir")
    [ "$n" -ge 2 ] || { echo "::error::the plan of #$issue proposes no split" >&2; exit 1; }
    prev=""; first=""; list=""
    for k in $(seq 1 "$n"); do
      title=$(head -1 "$dir/$k.title")
      {
        printf '<!-- factory:child-of %s -->\n' "$issue"
        printf '_Part %s of %s of #%s (split approved by @%s). The parent issue holds the full plan and the answers to its open questions._\n' "$k" "$n" "$issue" "$author"
        if [ -n "$prev" ]; then printf '_Starts when #%s is done._\n' "$prev"; fi
        printf '\n'; cat "$dir/$k.body" 2>/dev/null || true
      } > "$dir/$k.issue"
      created=$(gh api -X POST "repos/$R/issues" -f title="$title" -F body=@"$dir/$k.issue" -f 'labels[]=factory:story')
      num=$(echo "$created" | jq -r .number); id=$(echo "$created" | jq -r .id)
      gh api -X POST "repos/$R/issues/$issue/sub_issues" -F sub_issue_id="$id" >/dev/null || echo "::warning::could not link #$num as sub-issue of #$issue"
      board "$num" Inbox
      [ -n "$first" ] || first="$num"
      list="$list"$'\n'"- #$num $title"
      prev="$num"
    done
    rm -rf "$dir"
    set_state "$issue" factory:split; board "$issue" Split
    gh issue comment "$issue" --repo "$R" --body "$(printf '<!-- factory:split-done -->\n**Story split** into %s stories (sub-issues of this issue):\n%s\n\n#%s starts now with its own plan. Each next story starts when the previous one is done. This issue closes when all of them are closed.' "$n" "$list" "$first")" >/dev/null
    FACTORY_START_APPROVED=1 "$0" start "$first"
    echo "issue #$issue -> split into $n stories, #$first started"
    ;;

  create-tasks)
    # Runs only after an approver approved a plan with a "Human tasks" section.
    issue="$1"; assignee="$2"
    plan_id=$(gh api "repos/$R/issues/$issue/comments" --paginate | jq -rs --arg agents ",$AGENTS," \
      '[.[][] | (.user.login | ascii_downcase) as $u | select(($agents | ascii_downcase | contains("," + $u + ",")) and (.body | startswith("<!-- factory:breakdown -->")))] | last | .id // empty')
    marker="<!-- factory:tasks-created $plan_id -->"
    if bot_comments "$issue" | jq -e --arg m "$marker" 'any(.[]; contains($m))' >/dev/null; then echo "tasks of plan $plan_id already created"; exit 0; fi
    dir=$(mktemp -d); n=$(plan_tasks "$issue" "$dir"); list=""
    for k in $(seq 1 "$n"); do
      title=$(head -1 "$dir/$k.title")
      {
        printf '<!-- factory:human-task-of %s -->\n' "$issue"
        printf '_Needed by #%s. Only a human can do this. Close this issue when it is done; the release of #%s waits for it._\n\n' "$issue" "$issue"
        cat "$dir/$k.body" 2>/dev/null || true
        printf '\n\n**Never post secret values in issues or comments** (this repository is public). Store them as repository secrets: Settings, Secrets and variables, Actions.\n'
      } > "$dir/$k.issue"
      created=$(gh api -X POST "repos/$R/issues" -f title="Human task: $title" -F body=@"$dir/$k.issue" -f 'labels[]=factory:human-task' -f "assignees[]=$assignee")
      num=$(echo "$created" | jq -r .number); id=$(echo "$created" | jq -r .id)
      gh api -X POST "repos/$R/issues/$issue/sub_issues" -F sub_issue_id="$id" >/dev/null || echo "::warning::could not link #$num as sub-issue of #$issue"
      board "$num" "Human Task"
      list="$list"$'\n'"- #$num $title"
    done
    rm -rf "$dir"
    gh issue comment "$issue" --repo "$R" --body "$(printf '%s\n**Human tasks** for @%s (only a human can do these):\n%s\n\nThe build starts now. The release to production waits until all tasks are closed.' "$marker" "$assignee" "$list")" >/dev/null
    echo "issue #$issue: $n human task(s) created"
    ;;

  child-closed)
    # Parts are created by this automation and carry the parent marker in line 1.
    part="$1"
    pj=$(gh api "repos/$R/issues/$part")
    [ "$(echo "$pj" | jq -r .user.login)" = "$BOT" ] || { echo "#$part is not a factory part"; exit 0; }
    parent=$(echo "$pj" | jq -r '.body // ""' | head -1 | sed -nE 's/^<!-- factory:child-of ([0-9]+) -->.*/\1/p')
    [ -n "$parent" ] || { echo "#$part is not a factory part"; exit 0; }
    [ "$(gh api "repos/$R/issues/$parent" | jq -r .state)" = open ] || { echo "parent #$parent is already closed"; exit 0; }
    case "$(current_state "$parent")" in cancelled|done) echo "parent #$parent is already $(current_state "$parent")"; exit 0 ;; esac
    open=$(open_parts "$parent" | paste -sd' ' -)
    if [ -z "$open" ]; then
      if gh api "repos/$R/issues/$parent/sub_issues?per_page=100" | jq -e 'any(.[]; .state_reason == "completed")' >/dev/null; then
        gh issue comment "$parent" --repo "$R" --body "All parts of this story are closed. Closing it as completed." >/dev/null
        gh issue close "$parent" --repo "$R" --reason completed >/dev/null
        "$0" closed "$parent" completed
      else
        gh issue comment "$parent" --repo "$R" --body "All parts of this story were cancelled. Closing it as not planned." >/dev/null
        gh issue close "$parent" --repo "$R" --reason "not planned" >/dev/null
        "$0" closed "$parent" not_planned
      fi
      echo "parent #$parent closed (all parts closed)"; exit 0
    fi
    if [ "$(echo "$pj" | jq -r .state_reason)" = completed ]; then
      next="${open%% *}"
      if [ "$(current_state "$next")" = inbox ]; then
        FACTORY_START_APPROVED=1 "$0" start "$next" >/dev/null
        gh issue comment "$parent" --repo "$R" --body "#$part is done. #$next starts now." >/dev/null
        echo "parent #$parent: #$part done, #$next started"; exit 0
      fi
    fi
    echo "parent #$parent: #$part closed, open parts: $open"
    ;;

  reopened)
    issue="$1"
    for old in $STATE_LABELS; do gh issue edit "$issue" --repo "$R" --remove-label "$old" >/dev/null 2>&1 || true; done
    board "$issue" Inbox
    gh issue comment "$issue" --repo "$R" --body "$(printf '<!-- factory:reopened -->\n**Story reopened.** It waits in the inbox. Reply \`/start\` to start the breakdown.')" >/dev/null
    echo "issue #$issue reopened -> inbox"
    ;;

  *) echo "usage: $0 pr-updated|review|rework|ready-check|plan-ready|start|command|closed|reopened|split|child-closed|create-tasks ..." >&2; exit 2 ;;
esac
