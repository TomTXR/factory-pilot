#!/usr/bin/env bash
# Tests .github/scripts/board-status.sh with a stubbed curl: the add race with the
# board's auto-add workflow (first add fails with "Content already exists") is retried.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
mkdir "$W/bin"
cat > "$W/bin/curl" <<'STUB'
#!/usr/bin/env bash
body="${@: -1}"; echo "$body" >> "$STUB_DIR/calls"
case "$body" in
  *projectV2\(number*) echo '{"data":{"user":{"projectV2":{"id":"P","field":{"id":"F","options":[{"id":"O1","name":"Waiting: Blocked by other story"}]}}}}}' ;;
  *addProjectV2ItemById*)
    n=$(grep -c addProjectV2ItemById "$STUB_DIR/calls")
    if [ "$n" -le "${ADD_FAILS:-0}" ]; then echo '{"errors":[{"type":"UNPROCESSABLE","message":"Content already exists in this project"}]}'
    else echo '{"data":{"addProjectV2ItemById":{"item":{"id":"I1"}}}}'; fi ;;
  *updateProjectV2ItemFieldValue*) echo "$body" | grep -q '"I1"' && echo '{"data":{"updateProjectV2ItemFieldValue":{"projectV2Item":{"id":"I1"}}}}' || echo '{"errors":[{"message":"bad item"}]}' ;;
esac
STUB
chmod +x "$W/bin/curl"
fail=0
run() { rm -f "$W/calls"; touch "$W/calls"; PATH="$W/bin:$PATH" STUB_DIR="$W" ADD_FAILS=$1 BOARD_RETRY_WAIT=0 PROJECT_TOKEN=x PROJECT_LOGIN=u PROJECT_NUMBER=1 bash "$ROOT/.github/scripts/board-status.sh" NODE Waiting 2>/dev/null; }
out=$(run 0); [ $? -eq 0 ] && echo "$out" | grep -q "set to Waiting" || { echo "FAIL B1: normal add: $out"; fail=1; }
out=$(run 1); [ $? -eq 0 ] && echo "$out" | grep -q "set to Waiting" || { echo "FAIL B2: add race not retried: $out"; fail=1; }
grep -q updateProjectV2ItemFieldValue "$W/calls" || { echo "FAIL B2: status not set after retry"; fail=1; }
run 2 >/dev/null; [ $? -ne 0 ] || { echo "FAIL B3: a lasting add error must fail"; fail=1; }
[ "$fail" -eq 0 ] && echo "board-status: ok"
exit "$fail"
