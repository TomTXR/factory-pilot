#!/usr/bin/env bash
# Set the Status column of an issue on the factory board.
# Usage: board-status.sh <issue-node-id> <status>
# Env: PROJECT_TOKEN (classic PAT, scope project), PROJECT_LOGIN, PROJECT_NUMBER
# Plain GraphQL via curl: gh project commands demand read:org / read:discussion.
set -euo pipefail
node="$1"; status="$2"
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
oid=$(echo "$p" | jq -r --arg s "$status" '.data.user.projectV2.field.options[] | select(.name==$s) | .id')
[ -n "$oid" ] || { echo "::error::Status '$status' not found on the board"; exit 1; }
item=$(gql 'mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p, contentId:$c}){ item { id } } }' \
  "$(jq -n --arg p "$pid" --arg c "$node" '{p:$p, c:$c}')" | jq -r .data.addProjectV2ItemById.item.id)
gql 'mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p, itemId:$i, fieldId:$f, value:{singleSelectOptionId:$o}}){ projectV2Item { id } } }' \
  "$(jq -n --arg p "$pid" --arg i "$item" --arg f "$fid" --arg o "$oid" '{p:$p, i:$i, f:$f, o:$o}')" > /dev/null
echo "board: set to $status"
