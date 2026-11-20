#!/usr/bin/env bash
# Every acceptance criterion of a factory story has an automated test (AGENTS.md, "Tests").
# Usage: criteria-check.sh <branch>
# On a story branch (factory/issue-<n>) it reads the newest plan of the story (the
# breakdown comment by an agent login), takes the numbered acceptance criteria and looks
# for each ID "#<n> AC<k>" in the title of a test. One title may name several criteria:
# "#<n> AC3, AC4: ...". A criterion that cannot be automated is listed in the story
# record (knowledge/raw/stories/*-story-<n>-*.md) as "Not automated: AC<k> <reason>"; the
# agent reviewer judges the reason. A file, not the PR description: editing a description
# starts no CI run. Other branches pass.
# Every output line of a failure starts with FAIL: the CI-failure rework quotes only such lines.
# Env: GH_TOKEN, GITHUB_REPOSITORY, FACTORY_AGENT_LOGINS; CRITERIA_ROOT (tests only).
set -uo pipefail
branch="${1:-}"
root="${CRITERIA_ROOT:-.}"
if ! [[ "$branch" =~ ^factory/issue-([0-9]+)$ ]]; then echo "criteria: ok (not a story branch)"; exit 0; fi
n="${BASH_REMATCH[1]}"
if ! comments=$(gh api "repos/$GITHUB_REPOSITORY/issues/$n/comments" --paginate); then
  echo "FAIL criteria: cannot read the comments of issue #$n to find its plan."; exit 1
fi
plan=$(echo "$comments" | jq -rs --arg agents ",${FACTORY_AGENT_LOGINS:-}," \
  '[.[][] | (.user.login | ascii_downcase) as $u | select(($agents | ascii_downcase | contains("," + $u + ",")) and (.body | startswith("<!-- factory:breakdown -->")))] | last | .body // ""')
if [ -z "$plan" ]; then echo "::warning::criteria: issue #$n has no agent plan; nothing to trace"; exit 0; fi
# Top-level numbered lines of "## Acceptance criteria" (not the "####" copies in a proposed split).
criteria=$(echo "$plan" | tr -d '\r' | awk '/^## Acceptance criteria[[:space:]]*$/{f=1;next} /^## /{f=0} f && /^[0-9]+\. /')
if [ -z "$criteria" ]; then echo "criteria: ok (the plan of #$n has no numbered criteria)"; exit 0; fi
# IDs named in test titles, e.g. "#46 AC4" or "#46 AC4, AC6".
tested=$(grep -rhoE --include='*.test.ts' --include='*.test.tsx' --include='*.spec.ts' \
  "#$n AC[0-9]+(( *, *| and | )AC[0-9]+)*" "$root/api/src" "$root/web/src" "$root/e2e" 2>/dev/null \
  | grep -oE 'AC[0-9]+' | sort -u)
skipped=$(cat "$root"/knowledge/raw/stories/*-story-"$n"-*.md 2>/dev/null | tr -d '\r' | grep -iE '^[-* ]*Not automated:' | grep -oE 'AC[0-9]+' | sort -u)
fail=0
while IFS= read -r line; do
  k="${line%%.*}"
  if ! printf '%s\n%s\n' "$tested" "$skipped" | grep -qx "AC$k"; then
    [ "$fail" -eq 0 ] && echo "FAIL criteria: acceptance criteria of #$n without a test. Name the criterion in a test title, for example 'test(\"#$n AC$k: ...\")' (one title may name several: '#$n AC1, AC2: ...'), at the lowest test level that proves it (AGENTS.md, Tests). If it cannot be automated, add a line 'Not automated: AC<k> <reason>' to the story record knowledge/raw/stories/*-story-$n-*.md."
    echo "FAIL criteria: AC$k untested: $(echo "${line#*. }" | cut -c1-120)"
    fail=1
  fi
done <<< "$criteria"
[ "$fail" -eq 0 ] && echo "criteria: ok ($(echo "$criteria" | wc -l | tr -d ' ') criteria of #$n traced)"
exit "$fail"
