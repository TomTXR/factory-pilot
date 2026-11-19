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
#   factory-flow.sh ci-failed <pr> <run> <sha>  CI failed on a factory PR: send it back to the builder
#   factory-flow.sh plan-ready <issue>       breakdown posted a plan: notify approvers
#   factory-flow.sh start <issue>            new story: start the breakdown
#   factory-flow.sh command <issue> <id>     a comment by a human on a story issue (or a human task)
#   factory-flow.sh task-comment <issue> <id>  an approver commented on a human task: done -> close,
#                                            question -> answer-task.sh answers, or the task is blocked
#   factory-flow.sh closed <issue> <reason>  issue closed (completed | not_planned | duplicate)
#   factory-flow.sh reopened <issue>         issue reopened
#   factory-flow.sh split <issue> <approver> approved plan proposes a split: create the parts
#   factory-flow.sh child-closed <issue>     a part of a split story was closed: start the next
#                                            part, or close the parent when all parts are closed
#   factory-flow.sh create-tasks <issue> <assignee>  approved plan lists human tasks: create them
#   factory-flow.sh unblock <issue>          <issue> was closed: start waiting stories it blocked
#   factory-flow.sh status <issue> <text>    record progress in the story's status section (no email)
#   factory-flow.sh notify <issue> <text>    ask the approvers to act: comment with @mentions (email)
#
# Quiet mode: GitHub emails every participant about every new comment, but not
# about edits or reactions. So progress goes into a status section at the end of
# the issue body (edited in place), a handled human comment gets a reaction, and
# only messages that need a human action are new comments that @mention people.
#
# Dependencies are GitHub's native "blocked by" relations. Planning runs at once;
# a story whose plan is approved while a blocker is open waits (factory:waiting)
# and its build starts when the last blocker is completed.
#   factory-flow.sh followups <issue> <comment-id>   an approver asked for follow-up tickets:
#                                            write them (write-followups.sh), create them and start their breakdown
#
# Human tasks (accounts, external consoles, credentials) are sub-issues labelled
# factory:human-task, assigned to the approver. A release needs all of them closed.
# The assignee closes a task by hand or with a comment ("/done", "all done"). A
# question on a task gets an agent answer; if the agent cannot answer, the task
# is labelled factory:blocked and the other approvers are asked to decide.
#
# Humans steer only with comments: /approve, /changes <text>, /retry, /cancel,
# /followup <what> (create a follow-up ticket, any state), or plain
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
STATE_LABELS="factory:breakdown factory:plan-review factory:plan-approved factory:in-progress factory:agent-review factory:human-review factory:rework factory:approved-for-production factory:deploying factory:blocked factory:waiting factory:split factory:done factory:cancelled"
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
  for st in cancelled done split blocked waiting approved-for-production deploying human-review agent-review rework plan-approved in-progress plan-review breakdown; do
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
blockers() { # issue -> JSON array of the issues it is blocked by (number, state, state_reason)
  gh api "repos/$R/issues/$1/dependencies/blocked_by?per_page=100" | jq -c '[.[] | {number, state, state_reason}]'
}
open_blockers() { blockers "$1" | jq -r '.[] | select(.state == "open") | .number'; }
add_blocker() { # issue blocker: <issue> is blocked by <blocker>
  local bid; bid=$(gh api "repos/$R/issues/$2" | jq -r .id)
  gh api -X POST "repos/$R/issues/$1/dependencies/blocked_by" -F issue_id="$bid" >/dev/null || echo "::warning::could not mark #$1 as blocked by #$2"
}
open_tasks() { # story -> open human-task sub-issue numbers
  gh api "repos/$R/issues/$1/sub_issues?per_page=100" | jq -r '.[] | select(.state == "open" and ([.labels[]?.name] | index("factory:human-task"))) | .number'
}
approver_mentions() { echo "${FACTORY_APPROVERS:-}" | tr ',' '\n' | sed '/^$/d; s/^/@/' | paste -sd' ' -; }
# Owners get the action notifications of a story. Rule, first match wins (only approvers count):
#   1. its assignees (set by a human to hand over, or when an approver starts a stranger's story);
#   2. the owner key that this automation wrote into an issue it created (split part, follow-up);
#   3. the author of the story;
#   4. all approvers.
# Assigning is avoided otherwise: GitHub emails every assignment, which is not an action.
owner_mentions() { # issue -> "@a @b"
  local j m
  j=$(gh api "repos/$R/issues/$1")
  m=$(echo "$j" | jq -r '.assignees // [] | .[].login' | while read -r u; do is_approver "$u" && echo "@$u"; done | paste -sd' ' -)
  if [ -z "$m" ] && [ "$(echo "$j" | jq -r .user.login)" = "$BOT" ]; then
    m=$(echo "$j" | jq -r '.body // ""' | head -3 | sed -nE 's/^<!-- factory:owner ([A-Za-z0-9-]+) -->$/\1/p' | while read -r u; do is_approver "$u" && echo "@$u"; done | paste -sd' ' -)
  fi
  if [ -z "$m" ]; then u=$(echo "$j" | jq -r .user.login); is_approver "$u" && m="@$u"; fi
  [ -n "$m" ] && echo "$m" || approver_mentions
}
assign() { # issue login: add an assignee (GitHub notifies the new assignee once)
  gh api -X POST "repos/$R/issues/$1/assignees" -f "assignees[]=$2" >/dev/null || echo "::warning::could not assign $2 to #$1"
}
status() { # issue text [mark]: update the status section at the end of the issue body (edits send no email)
  # Optimistic concurrency: rebuild from a fresh read, skip the write if the issue
  # changed meanwhile (another step or a human edit), verify the line afterwards.
  local issue="$1" text="$2" mark="${3:-}" f j t1 body pre post block hist marks now line attempt
  f=$(mktemp)
  now=$(date -u +'%Y-%m-%d %H:%M')
  text=$(printf '%s' "$text" | tr '\n' ' ' | sed 's/ *$//')
  line="- $now $text"
  for attempt in 1 2 3 4 5; do
    j=$(gh api "repos/$R/issues/$issue"); t1=$(echo "$j" | jq -r '.updated_at // ""')
    body=$(echo "$j" | jq -r '.body // ""' | tr -d '\r')
    if printf '%s\n' "$body" | grep -qx '<!-- factory:status:start -->'; then
      pre=$(printf '%s\n' "$body" | sed '/^<!-- factory:status:start -->$/,$d')
      post=$(printf '%s\n' "$body" | sed '1,/^<!-- factory:status:end -->$/d')
      block=$(printf '%s\n' "$body" | sed -n '/^<!-- factory:status:start -->$/,/^<!-- factory:status:end -->$/p')
    else
      pre="$body"; post=""; block=""
    fi
    hist=$(printf '%s\n' "$block" | grep '^- ' | tail -29 || true)
    marks=$(printf '%s\n' "$block" | grep '^<!-- factory:mark ' || true)
    [ -n "$mark" ] && marks=$(printf '%s\n<!-- factory:mark %s -->' "$marks" "$mark" | sed '/^$/d')
    {
      printf '%s\n\n' "$(printf '%s' "$pre" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')"
      printf '<!-- factory:status:start -->\n---\n**Factory status** (%s UTC): %s\n\n<details><summary>History</summary>\n\n' "$now" "$text"
      [ -n "$hist" ] && printf '%s\n' "$hist"
      printf '%s\n\n</details>\n' "$line"
      [ -n "$marks" ] && printf '%s\n' "$marks"
      printf '<!-- factory:status:end -->\n'
      [ -n "$post" ] && printf '%s\n' "$post"
    } > "$f"
    if [ "$(gh api "repos/$R/issues/$issue" | jq -r '.updated_at // ""')" = "$t1" ] \
       && gh api -X PATCH "repos/$R/issues/$issue" -F body=@"$f" >/dev/null; then
      sleep "${STATUS_SETTLE:-2}"
      if gh api "repos/$R/issues/$issue" | jq -r '.body // ""' | grep -qxF -- "$line"; then rm -f "$f"; return 0; fi
    fi
    sleep "$(( ${STATUS_SETTLE:-2} * attempt ))"
  done
  rm -f "$f"; echo "::warning::status update of #$issue failed after 5 attempts: $text"
}
find_created() { # first-line key -> "number id" of an issue this automation already created with it
  [ -n "${BOT_ISSUES:-}" ] || BOT_ISSUES=$(gh api "repos/$R/issues?creator=$BOT&state=all&per_page=100" | jq -c '[.[] | {number, id, body: (.body // "")}]')
  echo "$BOT_ISSUES" | jq -r --arg key "$1" '[.[] | select(.body | startswith($key))] | if length > 0 then "\(.[0].number) \(.[0].id)" else empty end'
}
has_mark() { gh api "repos/$R/issues/$1" | jq -r '.body // ""' | grep -qF "<!-- factory:mark $2 -->"; }
notify() { # issue text: a human must act; the only bot comments that @mention people
  gh issue comment "$1" --repo "$R" --body "$(printf '%s\n\n%s' "$(owner_mentions "$1")" "$2")" >/dev/null
}
react() { gh api -X POST "repos/$R/issues/comments/$1/reactions" -f content="$2" >/dev/null || true; }
handled() { # comment-id issue: a reaction by this automation, or an old ack comment
  gh api "repos/$R/issues/comments/$1/reactions" | jq -e --arg bot "$BOT" 'any(.[]; .user.login == $bot)' >/dev/null && return 0
  bot_comments "$2" | jq -e --arg m "<!-- factory:ack $1 -->" 'any(.[]; contains($m))' >/dev/null
}
ack() { # issue comment-id text: done; thumbs-up on the comment, text into the status (no email)
  react "$2" +1; status "$1" "$3"
}
ask() { # issue comment-id text: the commenter must act again; reply with a mention of the author only
  react "$2" eyes
  gh issue comment "$1" --repo "$R" --body "$(printf '<!-- factory:ack %s -->\n@%s %s' "$2" "$ACK_TO" "$3")" >/dev/null
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
    status "$issue" "Agent: Reviewing PR #$pr."
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
        notify "$issue" "**Blocked:** the reviewer agent could not reach a verdict on PR #$pr ($url). Decide, then reply \`/retry\` or \`/changes <what>\`." ;;
      *) echo "no verdict marker, nothing to do" ;;
    esac
    ;;

  rework)
    issue="$1"; reason="$2"
    # Older runs marked a rework on both the issue and the PR; newer ones only on the PR.
    # The larger of the two counts is the number of reworks.
    n_issue=$(bot_comments "$issue" | jq '[.[] | select(contains("<!-- factory:rework -->"))] | length'); n_pr=0
    for p in $(gh api "repos/$R/pulls?state=all&per_page=100" | jq -r --arg ref "factory/issue-$issue" '.[] | select(.head.ref == $ref) | .number'); do
      n_pr=$((n_pr + $(bot_comments "$p" | jq '[.[] | select(contains("<!-- factory:rework -->"))] | length')))
    done
    n=$(( n_issue > n_pr ? n_issue : n_pr ))
    if [ "$n" -ge "$MAX_REWORK" ]; then
      for pr in $(open_factory_prs "$issue"); do review_status "$(gh api "repos/$R/pulls/$pr" | jq -r .head.sha)" pending "Blocked: rework limit reached"; done
      set_state "$issue" factory:blocked; board "$issue" Blocked
      notify "$issue" "**Blocked:** $n rework loops reached the limit of $MAX_REWORK. Decide how to continue, then reply \`/retry\` (optionally with instructions)." 
      echo "issue #$issue -> blocked (rework limit)"; exit 0
    fi
    prs=$(open_factory_prs "$issue")
    if [ -n "$prs" ]; then
      # Revise the open PR: the builder picks it up when the review status is failure.
      for pr in $prs; do
        gh pr comment "$pr" --repo "$R" --body "$(printf '<!-- factory:rework -->\n**Changes requested (rework %s of %s).** Address this in this PR:\n\n%s' "$((n+1))" "$MAX_REWORK" "$reason")" >/dev/null
        review_status "$(gh api "repos/$R/pulls/$pr" | jq -r .head.sha)" failure "Changes requested (rework $((n+1)) of $MAX_REWORK)"
      done
      status "$issue" "Rework $((n+1)) of $MAX_REWORK: the builder revises PR #$(echo $prs | tr ' ' ',') (reason on the PR)." 
      set_state "$issue" factory:rework; board "$issue" Rework
      echo "issue #$issue -> rework $((n+1)), builder revises PR $prs"; exit 0
    fi
    # No open PR (e.g. the builder judged the story unclear): start the builder again.
    gh issue comment "$issue" --repo "$R" --body "$(printf '<!-- factory:rework -->\n**Rework %s of %s.** No open PR; the builder starts again from `main` and reads this thread.\n\n%s' "$((n+1))" "$MAX_REWORK" "$reason")" >/dev/null
    set_state "$issue" factory:plan-approved; board "$issue" "In Progress"
    echo "issue #$issue -> rework $((n+1)), builder re-triggered"
    ;;

  ci-failed)
    # CI failed on a factory PR. The reviewer agent skips red heads, so without this
    # the story would wait in Agent: Reviewing forever. Send the PR back to the builder
    # with the failing jobs and error lines; it counts as a rework (limit applies).
    pr="$1"; run="$2"; sha="$3"
    issue=$(issue_of_pr "$pr"); [ -n "$issue" ] || { echo "not a factory PR"; exit 0; }
    case "$(current_state "$issue")" in
      in-progress|agent-review|rework|plan-approved) ;;
      *) echo "issue #$issue is in state $(current_state "$issue"): CI failure not handled"; exit 0 ;;
    esac
    prj=$(gh api "repos/$R/pulls/$pr")
    [ "$(echo "$prj" | jq -r .state)" = open ] || { echo "PR closed"; exit 0; }
    head=$(echo "$prj" | jq -r .head.sha)
    [ "$head" = "$sha" ] || { echo "run $run is for ${sha:0:7}, head is ${head:0:7}: stale"; exit 0; }
    marker="<!-- factory:ci-failed $sha -->"
    if bot_comments "$pr" | jq -e --arg m "$marker" 'any(.[]; contains($m))' >/dev/null; then echo "CI failure of ${sha:0:7} already sent back"; exit 0; fi
    jobs=$(gh api "repos/$R/actions/runs/$run/jobs?per_page=100" | jq -r '[.jobs[]? | select(.conclusion == "failure") | .name] | join(", ")')
    errors=$(gh run view "$run" --repo "$R" --log-failed 2>/dev/null \
      | sed -E 's/^[^\t]*\t[^\t]*\t[0-9TZ:.-]+ ?//' \
      | grep -E '✘|Error|error TS|FAIL|failed|expect|Expected|Received|^ *> *[0-9]+ \|' | grep -v '##\[' | awk '!seen[$0]++' | head -40 || true)
    conflict=""
    [ "$(echo "$prj" | jq -r '.mergeable')" = false ] && conflict=$'\n\nThe PR also conflicts with the current `main`: merge `main` into this branch and resolve the conflicts so that the features on `main` and this story both work.'
    reason=$(printf '%s\nCI failed on head %s (run https://github.com/%s/actions/runs/%s, failed jobs: %s). Fix the cause so that all checks pass; do not weaken or skip the failing tests unless they test the wrong thing.%s\n\n```\n%s\n```' \
      "$marker" "${sha:0:7}" "$R" "$run" "${jobs:-unknown}" "$conflict" "${errors:-(no error lines found; open the run)}")
    "$0" rework "$issue" "$reason"
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
    gh issue comment "$issue" --repo "$R" --body "$(printf '%s\n%s\n\n## Test request\n\nThe change for this story is ready for your review.\n\n- **Test version:** https://%s\n- **Pull request:** #%s (commit %s), CI green, reviewer agent approved\n%s\nPlease check the acceptance criteria of this issue on the test version (also on your phone). Then reply with a comment:\n\n- describe what must change (or `/changes <what>`): the builder revises the pull request, or\n- `/approve` to merge and deploy to production. A release always needs the explicit `/approve`.' "$marker" "$(owner_mentions "$issue")" "$host" "$pr" "${head:0:7}" "$tasks")" >/dev/null
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
    if bot_comments "$issue" | jq -e --arg m "$marker" 'any(.[]; contains($m))' >/dev/null || has_mark "$issue" "plan-ready $plan_id"; then echo "already notified"; exit 0; fi
    mentions=$(owner_mentions "$issue")
    if [ -z "$mentions" ]; then
      # Without approvers the notification would reach nobody; fail before writing the marker.
      echo "::error::FACTORY_APPROVERS is empty; cannot notify approvers" >&2; exit 1
    fi
    # The breakdown agent ends its plan with the review request and the approvers'
    # mentions: one comment, one email. Fall back to a separate notice if any is missing.
    plan=$(plan_body "$issue")
    missing=""
    for m in $mentions; do printf '%s' "$plan" | grep -qiF -- "$m" || missing="$missing $m"; done
    if [ -z "$missing" ]; then
      status "$issue" "Human: Review plan (the plan comment asks the approvers)." "plan-ready $plan_id"
      echo "issue #$issue: plan asks the approvers itself"; exit 0
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
    # A stranger's story started by an approver: that approver takes it over (one
    # assignment email, a real hand-over). Set before the agent reads the issue.
    if ! is_approver "$opener" && [ "$opener" != "$BOT" ] && [ -n "${FACTORY_STARTED_BY:-}" ] \
       && [ "$(gh api "repos/$R/issues/$issue" | jq '.assignees // [] | length')" -eq 0 ]; then
      assign "$issue" "$FACTORY_STARTED_BY"
    fi
    set_state "$issue" factory:breakdown; board "$issue" Breakdown
    status "$issue" "Agent: Planning. The breakdown agent writes a plan within about 5 minutes; the approvers are notified when it is ready." 
    echo "issue #$issue -> breakdown"
    ;;

  command)
    issue="$1"; cid="$2"
    c=$(gh api "repos/$R/issues/comments/$cid")
    author=$(echo "$c" | jq -r .user.login); body=$(echo "$c" | jq -r .body); curl_url=$(echo "$c" | jq -r .html_url)
    if ! is_approver "$author" || [ "$(echo "$c" | jq -r .user.type)" != "User" ]; then echo "ignored: $author is not an approver"; exit 0; fi
    if handled "$cid" "$issue"; then echo "already handled"; exit 0; fi
    ACK_TO="$author"
    tj=$(gh api "repos/$R/issues/$issue")
    if echo "$tj" | jq -e '[.labels[].name] | index("factory:human-task")' >/dev/null; then
      "$0" task-comment "$issue" "$cid"; exit 0
    fi
    state=$(current_state "$issue")
    cmd_line=$(printf '%s\n' "$body" | grep -ioE '^[[:space:]]*/(approve|changes|retry|start|cancel)\b' | head -1 | tr -d '[:space:]' | tr 'A-Z' 'a-z' || true)
    explicit=yes; intent=""; summary=""; followup=no
    if printf '%s\n' "$body" | grep -iqE '^[[:space:]]*/followup\b'; then
      followup=yes; [ -n "$cmd_line" ] || cmd_line=/followup
    fi
    case "$cmd_line" in
      /followup) intent=followup-only ;;
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
          [ "$(echo "$res" | jq -r '.followup // false')" = true ] && followup=yes
          echo "inferred: $intent ($summary), followup=$followup" ;;
        *) echo "plain comment outside a gate: no action"; exit 0 ;;
      esac
    fi
    read_as=""; [ "$explicit" = no ] && read_as="Read as: $intent - $summary. "
    by="by $author"   # names without @: only action requests notify people
    # Follow-up tickets first: they never change the state of this story, and a
    # failure there must not stop the rest of the comment.
    if [ "$followup" = yes ] && ! "$0" followups "$issue" "$cid"; then
      echo "::warning::follow-ups failed for comment $cid"
      gh issue comment "$issue" --repo "$R" --body "@$author The follow-up ticket requested in $curl_url could not be created (a GitHub call failed). The rest of the comment is handled. Reply \`/followup <what>\` to try again." >/dev/null || true
    fi
    case "$state:$intent" in
      inbox:approve|inbox:changes)
        FACTORY_START_APPROVED=1 FACTORY_STARTED_BY="$author" "$0" start "$issue" >/dev/null
        ack "$issue" "$cid" "Breakdown started $by." ;;
      plan-review:approve)
        dir=$(mktemp -d); parts=$(split_parts "$issue" "$dir"); rm -rf "$dir"
        if [ "$parts" -ge 2 ]; then
          "$0" split "$issue" "$author"
          ack "$issue" "$cid" "${read_as}Plan approved with split $by: $parts stories created as sub-issues."
        else
          tasks_note=""
          dir=$(mktemp -d); ntasks=$(plan_tasks "$issue" "$dir"); rm -rf "$dir"
          if [ "$ntasks" -ge 1 ]; then
            "$0" create-tasks "$issue" "$author"
            tasks_note=" $ntasks human task(s) were created and assigned to you (see above); the release waits for them."
          fi
          waiting=$(open_blockers "$issue" | sed 's/^/#/' | paste -sd' ' -)
          if [ -n "$waiting" ]; then
            set_state "$issue" factory:waiting; board "$issue" Waiting
            ack "$issue" "$cid" "${read_as}Plan approved $by. Waiting: the build waits for $waiting and starts automatically when they are done; /start builds now anyway.$tasks_note"
          else
            set_state "$issue" factory:plan-approved; board "$issue" "In Progress"
            ack "$issue" "$cid" "${read_as}Plan approved $by. Agent: Building starts within about 5 minutes.$tasks_note"
          fi
        fi ;;
      waiting:approve)
        if [ "$explicit" = yes ]; then
          set_state "$issue" factory:plan-approved; board "$issue" "In Progress"
          ack "$issue" "$cid" "Build started $by although it is blocked by $(open_blockers "$issue" | sed 's/^/#/' | paste -sd' ' -). The builder starts within about 5 minutes."
        fi ;;
      plan-review:changes)
        set_state "$issue" factory:breakdown; board "$issue" Breakdown
        ack "$issue" "$cid" "${read_as}Plan changes requested $by. The breakdown agent writes a refined plan within about 5 minutes." ;;
      human-review:approve)
        tasks=$(open_tasks "$issue" | sed 's/^/#/' | paste -sd' ' -)
        if [ "$explicit" = yes ] && [ -n "$tasks" ]; then
          ask "$issue" "$cid" "**Release on hold.** These human tasks are still open: $tasks. Close each one when it is done, then reply \`/approve\` again."
        elif [ "$explicit" = yes ]; then
          set_state "$issue" factory:approved-for-production; board "$issue" Deploying
          ack "$issue" "$cid" "Release approved $by. Agent: Deploying (merge, production deploy, smoke check)."
          emit land=true
        else
          ask "$issue" "$cid" "${read_as}A release to production needs an explicit decision. Reply \`/approve\` to merge and deploy, or \`/changes <what>\` to request changes."
        fi ;;
      human-review:changes)
        ack "$issue" "$cid" "${read_as}Changes requested $by. Agent: Reworking the pull request."
        "$0" rework "$issue" "$(printf 'Changes requested by %s (%s):\n\n> %s' "$author" "$curl_url" "$(printf '%s' "$body" | sed 's/^/> /' | tail -c 3000)")" ;;
      blocked:retry)
        prs=$(open_factory_prs "$issue")
        if [ -n "$prs" ]; then
          for pr in $prs; do review_status "$(gh api "repos/$R/pulls/$pr" | jq -r .head.sha)" failure "Retry requested by $author"; done
          set_state "$issue" factory:rework; board "$issue" Rework
          ack "$issue" "$cid" "Retry $by. The builder revises PR $(echo $prs | tr ' ' ',') and reads this thread."
        elif [ "$(gh api "repos/$R/issues/$issue/comments" --paginate | jq -s --arg agents ",$AGENTS," '[.[][] | (.user.login | ascii_downcase) as $u | select(($agents | ascii_downcase | contains("," + $u + ",")) and (.body | startswith("<!-- factory:breakdown -->")))] | length')" -gt 0 ]; then
          set_state "$issue" factory:plan-approved; board "$issue" "In Progress"
          ack "$issue" "$cid" "Retry $by. The builder starts again from the approved plan."
        else
          set_state "$issue" factory:breakdown; board "$issue" Breakdown
          ack "$issue" "$cid" "Retry $by. The breakdown agent starts again."
        fi ;;
      done:cancel|cancelled:cancel)
        ask "$issue" "$cid" "This story is already closed (**$state**)." ;;
      *:cancel)
        if [ "$explicit" = yes ]; then
          ack "$issue" "$cid" "Story cancelled $by. Open pull requests are closed and previews removed."
          # Close first: closed -> child-closed must see this issue as closed.
          gh issue close "$issue" --repo "$R" --reason "not planned" >/dev/null
          "$0" closed "$issue" not_planned
        else
          ask "$issue" "$cid" "${read_as}Cancelling a story needs an explicit decision. Reply \`/cancel\` to close it as not planned, or \`/changes <what>\` to change it."
        fi ;;
      *:followup-only)
        ack "$issue" "$cid" "Follow-up request $by handled. Nothing else changes on this story." ;;
      plan-review:unclear|human-review:unclear)
        if [ "$followup" = yes ]; then
          ask "$issue" "$cid" "${read_as}Follow-up request handled (see the status at the end of the issue). No other action. Reply \`/approve\` to proceed or \`/changes <what>\` to request changes."
        else
          ask "$issue" "$cid" "${read_as}No action taken. Reply \`/approve\` to proceed or \`/changes <what>\` to request changes."
        fi ;;
      *)
        if [ "$explicit" = yes ]; then
          ask "$issue" "$cid" "\`$cmd_line\` has no effect in the current state (**$state**). Commands apply at Plan Review and Human Review; \`/retry\` applies when a story is blocked."
        fi ;;
    esac
    ;;

  task-comment)
    # An approver commented on a human task. Only humans can do the task, so the
    # comment either reports it done (close it), or asks for help: the answer agent
    # replies from the plan and the wiki, and when it cannot, the task is blocked
    # and the other approvers are asked to decide.
    issue="$1"; cid="$2"
    c=$(gh api "repos/$R/issues/comments/$cid")
    author=$(echo "$c" | jq -r .user.login); body=$(echo "$c" | jq -r .body); ACK_TO="$author"
    tj=$(gh api "repos/$R/issues/$issue")
    parent=$(echo "$tj" | jq -r '(.parent_issue_url // "") | split("/") | last')
    if [ "$(echo "$tj" | jq -r .state)" = closed ]; then
      ask "$issue" "$cid" "This task is already closed. Reopen it if it needs more work, then comment again."; exit 0
    fi
    tcmd=$(printf '%s\n' "$body" | grep -oE '^[[:space:]]*/[A-Za-z]+' | head -1 | tr -d '[:space:]' | tr 'A-Z' 'a-z' || true)
    read_as=""
    case "$tcmd" in
      /done) intent=done ;;
      "")
        tmp=$(mktemp); printf '%s' "$body" > "$tmp"
        res=$("$here/classify-intent.sh" human-task "$tmp"); rm -f "$tmp"
        intent=$(echo "$res" | jq -r .intent); read_as="Read as: $intent - $(echo "$res" | jq -r .summary). "
        echo "task #$issue: inferred $intent" ;;
      *)
        ask "$issue" "$cid" "\`$tcmd\` does not apply to a human task. Reply \`/done\` (or write that it is done) when the task is finished, or write your question."; exit 0 ;;
    esac
    case "$intent" in
      done)
        ack "$issue" "$cid" "${read_as}Task done, reported by $author. Closed."
        gh issue close "$issue" --repo "$R" --reason completed >/dev/null
        gh issue edit "$issue" --repo "$R" --remove-label factory:blocked >/dev/null 2>&1 || true
        board "$issue" Done
        if [ -n "$parent" ]; then
          left=$(open_tasks "$parent" | sed 's/^/#/' | paste -sd' ' -)
          status "$parent" "Human task #$issue done ($author). Open human tasks: ${left:-none}."
        fi
        # Closing by GITHUB_TOKEN triggers no event: release what this task blocked here.
        "$0" unblock "$issue"
        echo "task #$issue -> done" ;;
      other)
        ack "$issue" "$cid" "${read_as}Comment noted. No action." ;;
      *)
        # question, or unclear (classifier failed): a human asked for help.
        d=$(mktemp -d)
        echo "$tj" | jq -r '"# " + .title + "\n\n" + (.body // "")' > "$d/task"
        : > "$d/story"; : > "$d/plan"
        if [ -n "$parent" ]; then
          # The story body only when an approver or this automation wrote it (anyone can open a story).
          pj=$(gh api "repos/$R/issues/$parent"); pa=$(echo "$pj" | jq -r .user.login)
          if is_approver "$pa" || [ "$pa" = "$BOT" ]; then
            echo "$pj" | jq -r '"# #" + (.number|tostring) + " " + .title + "\n\n" + (.body // "")' > "$d/story"
          else
            echo "$pj" | jq -r '"# #" + (.number|tostring) + " " + .title + "\n\n(story text omitted: written by a non-approver)"' > "$d/story"
          fi
          plan_body "$parent" > "$d/plan"
        fi
        # Thread: approvers and this automation only (public repository: anyone can comment).
        gh api "repos/$R/issues/$issue/comments" --paginate | jq -c '.[]' | while read -r cm; do
          u=$(echo "$cm" | jq -r .user.login)
          { is_approver "$u" || [ "$u" = "$BOT" ]; } && echo "$cm" | jq -r '"### " + .user.login + "\n" + .body + "\n"'
        done > "$d/thread" || true
        res=$("$here/answer-task.sh" "$d/task" "$d/story" "$d/plan" "$d/thread" 2>/dev/null) || true
        echo "$res" | jq -e 'type == "object"' >/dev/null 2>&1 || res='{"answered":false,"reason":"the answer agent failed"}'
        # Last line of defence: never post anything that looks like a token.
        if echo "$res" | jq -r '.answer // ""' | grep -qE '(gh[opsur]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|GOCSPX-[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY)'; then
          echo "::warning::answer for task #$issue looked like it contained a credential; not posted"
          res='{"answered":false,"reason":"the answer was withheld because it looked like it contained a credential"}'
        fi
        rm -rf "$d"
        if [ "$(echo "$res" | jq -r '.answered // false')" = true ]; then
          if echo "$tj" | jq -e '[.labels[].name] | index("factory:blocked")' >/dev/null; then
            gh issue edit "$issue" --repo "$R" --remove-label factory:blocked >/dev/null 2>&1 || true
            board "$issue" "Human Task"
          fi
          ask "$issue" "$cid" "$(printf '%s\n\n---\n_Answered by an agent from the task, the plan and the wiki; it cannot do the task. Reply `/done` (or write that it is done) when the task is finished, or ask again._' "$(echo "$res" | jq -r .answer)")"
          echo "task #$issue: answered"
        else
          reason=$(echo "$res" | jq -r '.reason // "no answer"')
          gh issue edit "$issue" --repo "$R" --add-label factory:blocked >/dev/null
          board "$issue" Blocked
          react "$cid" eyes
          others=$(echo "${FACTORY_APPROVERS:-}" | tr ',' '\n' | sed '/^$/d' | grep -vix -- "$author" | sed 's/^/@/' | paste -sd' ' - || true)
          who="${others:-@$author}"
          story_ref=""; [ -n "$parent" ] && story_ref=" or cancel story #$parent with \`/cancel\` there"
          gh issue comment "$issue" --repo "$R" --body "$(printf '<!-- factory:ack %s -->\n%s The agent cannot answer the question of %s on this task (%s). A human must decide: answer here, change the task%s. Reply `/done` when the task is finished.' "$cid" "$who" "$author" "$reason" "$story_ref")" >/dev/null
          echo "task #$issue: blocked, asked $who"
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
        status "$issue" "Cancelled. Closed PRs: ${prs:-none}."
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
    "$0" unblock "$issue"
    ;;

  unblock)
    issue="$1"
    for w in $(gh api "repos/$R/issues/$issue/dependencies/blocking?per_page=100" | jq -r '.[] | select(.state == "open") | .number'); do
      [ "$(current_state "$w")" = waiting ] || { echo "#$w is not waiting"; continue; }
      bl=$(blockers "$w")
      if [ "$(echo "$bl" | jq '[.[] | select(.state == "open")] | length')" -gt 0 ]; then echo "#$w still blocked"; continue; fi
      dropped=$(echo "$bl" | jq -r '.[] | select(.state_reason != "completed") | "#\(.number)"' | paste -sd' ' -)
      if [ -n "$dropped" ]; then
        notify "$w" "Blocker $dropped was closed without being completed. This story keeps waiting. Reply \`/start\` to build it anyway, or \`/cancel\` to drop it." 
        echo "#$w: blocker dropped, asked the approvers"; continue
      fi
      set_state "$w" factory:plan-approved; board "$w" "In Progress"
      status "$w" "All blockers are done (last: #$issue). Agent: Building starts within about 5 minutes." 
      echo "#$w unblocked -> plan approved"
    done
    ;;

  split)
    # Runs only after an approver approved a plan with a "Proposed split" section.
    issue="$1"; author="$2"
    # Old runs left a comment marker; new runs reuse parts found by their key (no shared state to race on).
    if bot_comments "$issue" | jq -e 'any(.[]; contains("<!-- factory:split-done -->"))' >/dev/null; then echo "issue #$issue already split"; exit 0; fi
    dir=$(mktemp -d); n=$(split_parts "$issue" "$dir")
    [ "$n" -ge 2 ] || { echo "::error::the plan of #$issue proposes no split" >&2; exit 1; }
    prev=""; first=""; list=""
    for k in $(seq 1 "$n"); do
      title=$(head -1 "$dir/$k.title")
      key="<!-- factory:child-of $issue part $k -->"
      found=$(find_created "$key")
      if [ -n "$found" ]; then
        num="${found%% *}"
        [ -n "$first" ] || first="$num"
        list="$list"$'\n'"- #$num $title"; prev="$num"; continue
      fi
      {
        printf '%s\n<!-- factory:owner %s -->\n' "$key" "$author"
        printf '_Part %s of %s of #%s (split approved by %s). The parent issue holds the full plan and the answers to its open questions._\n' "$k" "$n" "$issue" "$author"
        if [ -n "$prev" ]; then printf '_Starts when #%s is done._\n' "$prev"; fi
        printf '\n'; cat "$dir/$k.body" 2>/dev/null || true
      } > "$dir/$k.issue"
      created=$(gh api -X POST "repos/$R/issues" -f title="$title" -F body=@"$dir/$k.issue" -f 'labels[]=factory:story')
      num=$(echo "$created" | jq -r .number); id=$(echo "$created" | jq -r .id)
      gh api -X POST "repos/$R/issues/$issue/sub_issues" -F sub_issue_id="$id" >/dev/null || echo "::warning::could not link #$num as sub-issue of #$issue"
      # Later parts start on their own when the previous part is done: no human action.
      if [ -n "$prev" ]; then board "$num" Waiting; else board "$num" Inbox; fi
      if [ -n "$prev" ]; then add_blocker "$num" "$prev"
      else for b in $(open_blockers "$issue"); do add_blocker "$num" "$b"; done; fi
      [ -n "$first" ] || first="$num"
      list="$list"$'\n'"- #$num $title"
      prev="$num"
    done
    rm -rf "$dir"
    set_state "$issue" factory:split; board "$issue" Split
    status "$issue" "Split into $n stories:$(echo "$list" | sed 's/^- / /' | paste -sd',' -). #$first starts now with its own plan; each next one starts when the previous one is done. This issue closes when all are closed."
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
      key="<!-- factory:human-task-of $issue plan $plan_id part $k -->"
      found=$(find_created "$key")
      if [ -n "$found" ]; then list="$list"$'\n'"- #${found%% *} $title"; continue; fi
      {
        printf '%s\n' "$key"
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
    # The assignment notifies the assignee; no extra comment.
    status "$issue" "Human tasks for $assignee (assigned):$(echo "$list" | sed 's/^- / /' | paste -sd',' -). The release waits until all are closed."
    echo "issue #$issue: $n human task(s) created"
    ;;

  followups)
    # Only reached from command, i.e. for a comment by an approver.
    issue="$1"; cid="$2"
    marker="<!-- factory:followups $cid -->"
    if bot_comments "$issue" | jq -e --arg m "$marker" 'any(.[]; contains($m))' >/dev/null; then echo "follow-ups of comment $cid already handled"; exit 0; fi
    c=$(gh api "repos/$R/issues/comments/$cid")
    author=$(echo "$c" | jq -r .user.login); url=$(echo "$c" | jq -r .html_url)
    dir=$(mktemp -d)
    gh api "repos/$R/issues/$issue" | jq -r '"# " + .title + "\n\n" + (.body // "")' > "$dir/story"
    plan_body "$issue" > "$dir/plan"
    echo "$c" | jq -r .body > "$dir/comment"
    res=$("$here/write-followups.sh" "$dir/story" "$dir/plan" "$dir/comment") || res='{"stories":[]}'
    n=$(echo "$res" | jq '.stories | length')
    if [ "$n" -eq 0 ]; then
      gh issue comment "$issue" --repo "$R" --body "$(printf '%s\n@%s No follow-up story could be written from your comment (%s). Describe it with `/followup <what>`.' "$marker" "$author" "$url")" >/dev/null
      rm -rf "$dir"; echo "no follow-up written"; exit 0
    fi
    list=""
    # Stories of an earlier, interrupted run for this comment are reused, not created again.
    for k in $(seq 0 $((n - 1))); do
      title=$(echo "$res" | jq -r ".stories[$k].title")
      key="<!-- factory:followup-of $issue comment $cid part $k -->"
      found=$(find_created "$key")
      if [ -n "$found" ]; then list="$list"$'\n'"- #${found%% *} $title"; continue; fi
      {
        printf '%s\n<!-- factory:owner %s -->\n' "$key" "$author"
        echo "$res" | jq -r ".stories[$k].body"
        printf '\n---\n_Follow-up of #%s, requested by %s: %s. Written by the factory from the plan and that comment._\n' "$issue" "$author" "$url"
      } > "$dir/$k.issue"
      created=$(gh api -X POST "repos/$R/issues" -f title="$title" -F body=@"$dir/$k.issue" -f 'labels[]=factory:story')
      num=$(echo "$created" | jq -r .number)
      board "$num" Inbox
      # Deferred work builds on the story it came from.
      add_blocker "$num" "$issue"
      # The approver asked for it: the breakdown starts; the build still needs plan approval.
      FACTORY_START_APPROVED=1 "$0" start "$num" >/dev/null
      list="$list"$'\n'"- #$num $title"
    done
    rm -rf "$dir"
    status "$issue" "Follow-up stories created (requested by $author):$(echo "$list" | sed 's/^- / /' | paste -sd',' -). Their planning starts now; each is blocked by this story."
    echo "issue #$issue: $n follow-up(s) created"
    ;;

  status) status "$1" "$2"; echo "status of #$1 updated" ;;
  notify) notify "$1" "$2"; echo "approvers notified on #$1" ;;

  child-closed)
    # Parts are created by this automation and carry the parent marker in line 1.
    part="$1"
    pj=$(gh api "repos/$R/issues/$part")
    [ "$(echo "$pj" | jq -r .user.login)" = "$BOT" ] || { echo "#$part is not a factory part"; exit 0; }
    parent=$(echo "$pj" | jq -r '.body // ""' | head -1 | sed -nE 's/^<!-- factory:child-of ([0-9]+)( part [0-9]+)? -->.*/\1/p')
    [ -n "$parent" ] || { echo "#$part is not a factory part"; exit 0; }
    [ "$(gh api "repos/$R/issues/$parent" | jq -r .state)" = open ] || { echo "parent #$parent is already closed"; exit 0; }
    case "$(current_state "$parent")" in cancelled|done) echo "parent #$parent is already $(current_state "$parent")"; exit 0 ;; esac
    open=$(open_parts "$parent" | paste -sd' ' -)
    if [ -z "$open" ]; then
      if gh api "repos/$R/issues/$parent/sub_issues?per_page=100" | jq -e 'any(.[]; .state_reason == "completed")' >/dev/null; then
        status "$parent" "All parts are closed. Closing this story as completed." 
        gh issue close "$parent" --repo "$R" --reason completed >/dev/null
        "$0" closed "$parent" completed
      else
        status "$parent" "All parts were cancelled. Closing this story as not planned." 
        gh issue close "$parent" --repo "$R" --reason "not planned" >/dev/null
        "$0" closed "$parent" not_planned
      fi
      echo "parent #$parent closed (all parts closed)"; exit 0
    fi
    if [ "$(echo "$pj" | jq -r .state_reason)" = completed ]; then
      next="${open%% *}"
      if [ "$(current_state "$next")" = inbox ]; then
        FACTORY_START_APPROVED=1 "$0" start "$next" >/dev/null
        status "$parent" "#$part is done. #$next starts now." 
        echo "parent #$parent: #$part done, #$next started"; exit 0
      fi
    else
      # A cancelled part: the next part may no longer make sense. A human decides.
      next="${open%% *}"
      if [ "$(current_state "$next")" = inbox ]; then
        board "$next" Inbox
        notify "$next" "The previous part #$part was closed without being completed. Reply \`/start\` to plan this part anyway, or \`/cancel\` to drop it."
        echo "parent #$parent: #$part cancelled, asked about #$next"; exit 0
      fi
    fi
    echo "parent #$parent: #$part closed, open parts: $open"
    ;;

  reopened)
    issue="$1"
    for old in $STATE_LABELS; do gh issue edit "$issue" --repo "$R" --remove-label "$old" >/dev/null 2>&1 || true; done
    board "$issue" Inbox
    status "$issue" "Reopened. Human: Start story - reply /start to start the breakdown." 
    echo "issue #$issue reopened -> inbox"
    ;;

  *) echo "usage: $0 pr-updated|review|rework|ready-check|plan-ready|start|command|closed|reopened|split|child-closed|create-tasks|followups|unblock|status|notify ..." >&2; exit 2 ;;
esac
