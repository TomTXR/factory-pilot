#!/usr/bin/env bash
# Tests the app-secret block of deploy/server/pilot-deploy.sh: values arrive
# unchanged, sourcing the env file never executes them, only PILOT_<NAME> passes.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
{ echo 'envfile=$1'; sed -n '/^if \[ "\$project" = "pilot-prod" \]; then/,/^fi/p' "$ROOT/deploy/server/pilot-deploy.sh" | sed '1d;$d' | grep -v 'log info'; } > "$W/block.sh"
printf "POSTGRES_PASSWORD=abc\nPILOT_OLD='x'\n" > "$W/app.env"
printf '%s\n' "PILOT_A=it's \$(touch $W/pwned) \`touch $W/pwned\` \"q\" a=b \\ end" "PILOT_B=plain" "EVIL=1" "pilot_c=lower" \
  | bash "$W/block.sh" "$W/app.env"
out=$(bash -c 'set -a; . "$1"; printf "%s|%s|%s|%s|%s" "$PILOT_A" "$PILOT_B" "${PILOT_OLD:-unset}" "${EVIL:-unset}" "$POSTGRES_PASSWORD"' _ "$W/app.env")
want="it's \$(touch $W/pwned) \`touch $W/pwned\` \"q\" a=b \\ end|plain|unset|unset|abc"
fail=0
[ "$out" = "$want" ] || { echo "FAIL values: got [$out]"; fail=1; }
[ ! -e "$W/pwned" ] || { echo "FAIL a secret value was executed"; fail=1; }
[ "$fail" -eq 0 ] && echo "pilot-deploy-env: ok"
exit "$fail"
