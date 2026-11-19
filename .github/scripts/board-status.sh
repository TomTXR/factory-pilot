#!/usr/bin/env bash
# Set the Status column of an issue on the factory board.
# Usage: board-status.sh <issue-node-id> <status>
#   status: the internal state name used by the scripts (Inbox, Breakdown, Plan Review, ...).
#   The board shows display names that say who acts next; display_name maps them.
#   An internal name is also accepted as the board option (older boards).
# Env: PROJECT_TOKEN (classic PAT, scope project), PROJECT_LOGIN, PROJECT_NUMBER
# Plain GraphQL via curl: gh project commands demand read:org / read:discussion.
set -euo pipefail
node="$1"; status="$2"
display_name() {
  case "$1" in
    Inbox) echo "Human: Start story" ;;
    Breakdown) echo "Agent: Planning" ;;
    "Plan Review") echo "Human: Review plan" ;;
    Waiting) echo "Waiting: Blocked by other story" ;;
    "In Progress") echo "Agent: Building" ;;
    "Agent Review") echo "Agent: Reviewing" ;;
    "Human Review") echo "Human: Test and release" ;;
    "Human Task") echo "Human: Do task" ;;
    Rework) echo "Agent: Reworking" ;;
    Deploying) echo "Agent: Deploying" ;;
    Split) echo "Split: Parts in progress" ;;
    Blocked) echo "Human: Decide (blocked)" ;;
    *) echo "$1" ;;
  esac
}
if [ -z "${PROJECT_TOKEN:-}" ]; then echo "::warning::PROJECT_TOKEN not set, skipping board update"; exit 0; fi
gql() {
  local out
  out=$(curl -sS -H "Authorization: bearer $PROJECT_TOKEN" -H "Content-Type: application/json" \
    https://api.github.com/graphql -d "$(jq -n --arg q "$1" --argjson v "$2" '{query:$q, variables:$v}')")
  if [ "$(echo "$out" | jq '.errors // [] | length')" != "0" ]; then echo "$out" | jq -c .errors >&2; exit 1; fi
  echo "$out"
}
p=$(gql 'query($login:String!,$n:Int!){ user(login:$login){ projectV2(number:$n){ id field(name:"Status"){ ... on ProjectV2SingleSelectField { id options { id name } } } } } }' \
  "$(jq -n --arg l "$PROJECT_LOGIN" --argjson n "$PROJECT_NUMBER" '{login:$l, n:$n}')")
pid=$(echo "$p" | jq -r .data.user.projectV2.id)
fid=$(echo "$p" | jq -r .data.user.projectV2.field.id)
label=$(display_name "$status")
oid=$(echo "$p" | jq -r --arg a "$label" --arg b "$status" '[.data.user.projectV2.field.options[] | select(.name==$a)] + [.data.user.projectV2.field.options[] | select(.name==$b)] | first | .id // empty')
[ -n "$oid" ] || { echo "::error::Status '$label' ($status) not found on the board"; exit 1; }
add_item() {
  gql 'mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p, contentId:$c}){ item { id } } }' \
    "$(jq -n --arg p "$pid" --arg c "$node" '{p:$p, c:$c}')" | jq -r .data.addProjectV2ItemById.item.id
}
# Adding is idempotent, except while the board's own auto-add workflow adds the same new
# issue: then GitHub answers "Content already exists in this project" (#61 kept no status).
# A second call returns the existing item.
item=$(add_item) || { sleep "${BOARD_RETRY_WAIT:-3}"; item=$(add_item); }
gql 'mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p, itemId:$i, fieldId:$f, value:{singleSelectOptionId:$o}}){ projectV2Item { id } } }' \
  "$(jq -n --arg p "$pid" --arg i "$item" --arg f "$fid" --arg o "$oid" '{p:$p, i:$i, f:$f, o:$o}')" > /dev/null
echo "board: set to $label"
