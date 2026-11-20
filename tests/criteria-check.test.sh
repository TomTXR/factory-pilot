#!/usr/bin/env bash
# Tests .github/scripts/criteria-check.sh: every acceptance criterion of the plan has a test.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/.github/scripts/criteria-check.sh"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
mkdir -p "$W/bin" "$W/repo/api/src" "$W/repo/web/src" "$W/repo/e2e/tests"
# Stub gh: prints $W/comments.json, or fails when it is missing.
cat > "$W/bin/gh" <<'STUB'
#!/usr/bin/env bash
[ -f "$COMMENTS" ] || exit 1
cat "$COMMENTS"
STUB
chmod +x "$W/bin/gh"
plan() { # body text with the plan sections; criteria lines given as arguments
  printf '<!-- factory:breakdown -->\n## Summary\nx\n\n## Acceptance criteria\n\nMobile at 390 px\n\n'
  printf '%s\n' "$@" '   4. a nested step, not a criterion'
  printf '\n## Out of scope\n- 9. not a criterion\n\n## Proposed split\n#### Acceptance criteria\n7. Given a copy, then ignored\n'
}
comments() { # login:body pairs as files -> JSON array
  local out="["; local sep=""
  while [ $# -gt 0 ]; do out="$out$sep$(jq -n --arg l "$1" --rawfile b "$2" '{user:{login:$l}, body:$b}')"; sep=","; shift 2; done
  echo "$out]" > "$W/comments.json"
}
plan "1. Given A, then a." "2. Given B, then b." "3. Given C, then c." > "$W/p3"
plan "1. Given A, then a." > "$W/p1"
fail=0
check() { # name expected-exit branch [story-record-text]
  mkdir -p "$W/repo/knowledge/raw/stories"; rm -f "$W/repo/knowledge/raw/stories/"*
  [ -n "${4:-}" ] && printf '%s\n' "$4" > "$W/repo/knowledge/raw/stories/2026-11-20-story-46-x.md"
  out=$(PATH="$W/bin:$PATH" COMMENTS="$W/comments.json" GITHUB_REPOSITORY=o/r FACTORY_AGENT_LOGINS=Domigo-Factory-Bot \
    CRITERIA_ROOT="$W/repo" bash "$S" "$3" 2>&1); got=$?
  [ "$got" = "$2" ] || { echo "FAIL $1: exit $got, want $2"; echo "$out"; fail=1; }
}
tests() { # writes the test titles into the three test locations
  rm -f "$W/repo/api/src/"*.ts "$W/repo/web/src/"*.tsx "$W/repo/e2e/tests/"*.ts
  printf "it('%s', () => {})\n" "$1" > "$W/repo/api/src/a.test.ts"
  printf "it('%s', () => {})\n" "$2" > "$W/repo/web/src/b.test.tsx"
  printf "test('%s', async () => {})\n" "$3" > "$W/repo/e2e/tests/c.spec.ts"
}
comments domigo-factory-bot "$W/p3"
check C1 0 main
tests "#46 AC1: unit" "#46 AC2: web" "#46 AC3: flow"
check C2 0 factory/issue-46
tests "#46 AC1: unit" "#46 AC2: web" "no id"
check C3 1 factory/issue-46
echo "$out" | grep -q '^FAIL criteria' && echo "$out" | grep -q 'AC3 untested: Given C' || { echo "FAIL C3b: missing FAIL line or AC3"; echo "$out"; fail=1; }
tests "#46 AC1: unit" "" ""
check C3c 1 factory/issue-46
# The CI-failure rework quotes only lines its filter keeps (factory-flow.sh ci-failed): every missing criterion must survive it.
kept=$(echo "$out" | grep -E '✘|Error|error TS|FAIL|failed|expect|Expected|Received')
echo "$kept" | grep -q 'AC2 untested' && echo "$kept" | grep -q 'AC3 untested' || { echo "FAIL C3c: the rework filter drops a criterion"; echo "$out"; fail=1; }
tests "#46 AC1, AC2 and AC3: all in one" "" ""
check C4 0 factory/issue-46
tests "#46 AC1: unit" "#46 AC2: web" ""
check C5 0 factory/issue-46 $'Body\n- Not automated: AC3 visual border colour only'
check C5b 1 factory/issue-46 'Mentions AC3 but not as not automated'
mkdir -p "$W/repo/knowledge/raw/stories"; printf -- '- Not automated: AC3 x\n' > "$W/repo/knowledge/raw/stories/2026-11-20-story-146-y.md"
out=$(PATH="$W/bin:$PATH" COMMENTS="$W/comments.json" GITHUB_REPOSITORY=o/r FACTORY_AGENT_LOGINS=domigo-factory-bot CRITERIA_ROOT="$W/repo" bash "$S" factory/issue-46 2>&1) \
  && { echo "FAIL C5c: another story's record excused AC3"; fail=1; }
tests "#146 AC3: other story" "#46 AC1: a" "#46 AC2: b"
check C6 1 factory/issue-46   # another story's AC3
tests "#46 AC13: other criterion" "#46 AC2: b" "#46 AC3: c"
check C6b 1 factory/issue-46  # AC13 is not AC1
tests "#12 AC3, #46 AC1, AC2: an older test that also proves #46" "" "#46 AC3: c"
check C12 0 factory/issue-46  # an existing test carries a second story's IDs
tests "#46 AC1, AC2, #12 AC3: older story's AC3 last" "" ""
check C12b 1 factory/issue-46 # #12's AC3 does not count for #46
printf 'free text\n' > "$W/h"
comments someone-else "$W/p3"
check C7 0 factory/issue-46   # a plan by a non-agent does not count: no plan, nothing to trace
comments domigo-factory-bot "$W/p1" domigo-factory-bot "$W/p3" AxemanNL "$W/h"
tests "#46 AC1: a" "" ""
check C8 1 factory/issue-46   # the newest agent plan has 3 criteria
comments domigo-factory-bot "$W/p3" domigo-factory-bot "$W/p1" someone-else "$W/p3"
check C9 0 factory/issue-46   # the newest agent plan has 1; "7." in the split copy and "9." in Out of scope are ignored
comments domigo-factory-bot "$W/p3"
rm -f "$W/comments.json"
check C11 1 factory/issue-46  # comments cannot be read
[ "$fail" -eq 0 ] && echo "criteria-check: ok"
exit "$fail"
