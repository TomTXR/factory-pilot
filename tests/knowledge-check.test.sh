#!/usr/bin/env bash
# Tests .github/scripts/knowledge-check.sh: which changes need a wiki update and a story record.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/.github/scripts/knowledge-check.sh"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
mkdir -p "$W/knowledge/raw/stories"; touch "$W/knowledge/raw/stories/2026-11-19-story-7-thing.md"
fail=0
check() { # name expected-exit branch files...
  name=$1 want=$2 branch=$3; shift 3
  out=$(printf '%s\n' "$@" | KNOWLEDGE_ROOT="$W" bash "$S" "$branch"); got=$?
  [ "$got" = "$want" ] || { echo "FAIL $name: exit $got, want $want"; echo "$out"; fail=1; }
}
check K1 1 main api/src/app.ts
check K2 0 main api/src/app.ts knowledge/wiki/architecture/api.md
check K3 0 main api/src/app.test.ts web/src/App.test.tsx
check K4 0 main .github/scripts/factory-flow.sh README.md
check K5 1 main api/migrations/005_x.sql knowledge/raw/stories/2026-11-19-story-9-x.md
check K6 1 factory/issue-8 web/src/App.tsx knowledge/wiki/index.md
check K7 0 factory/issue-7 web/src/App.tsx knowledge/wiki/index.md
check K8 1 factory/issue-7 web/src/App.tsx
check K9 1 factory/issue-70 knowledge/wiki/index.md
check K10 0 factory/issue-7x web/src/App.test.tsx
out=$(printf 'api/src/app.ts\n' | KNOWLEDGE_ROOT="$W" bash "$S" main)
echo "$out" | grep -q '^FAIL knowledge' || { echo "FAIL K11: no FAIL line for the rework quote"; fail=1; }
[ "$fail" -eq 0 ] && echo "knowledge-check: ok"
exit "$fail"
