#!/usr/bin/env bash
# Every change must keep the knowledge wiki current (AGENTS.md, "Knowledge").
# Usage: git diff --name-only <base>...HEAD | knowledge-check.sh <branch>
# Fails when app code changed but no wiki article, or when a factory story
# branch (factory/issue-<n>) has no story record knowledge/raw/stories/*-story-<n>-*.md.
# The output lines start with FAIL so that the CI-failure rework quotes them.
set -uo pipefail
branch="${1:-}"
root="${KNOWLEDGE_ROOT:-.}"
files=$(cat)
code=$(echo "$files" | grep -E '^(api/src|api/migrations|web/src)/' | grep -vE '\.test\.tsx?$' || true)
wiki=$(echo "$files" | grep -E '^knowledge/wiki/.+\.md$' || true)
fail=0
if [ -n "$code" ] && [ -z "$wiki" ]; then
  echo "FAIL knowledge: app code changed but no article in knowledge/wiki/ was updated."
  echo "  Update the articles of the concepts you changed"
  echo "  (product/, architecture/, design/, decisions/), their front matter (summary, concepts), then run npm run wiki:index, as AGENTS.md section Knowledge says. Changed code:"
  echo "$code" | head -10 | sed 's/^/    /'
  fail=1
fi
if [[ "$branch" =~ ^factory/issue-([0-9]+)$ ]]; then
  n="${BASH_REMATCH[1]}"
  if ! compgen -G "$root/knowledge/raw/stories/*-story-$n-*.md" >/dev/null; then
    echo "FAIL knowledge: story record missing. Create knowledge/raw/stories/YYYY-MM-DD-story-$n-<slug>.md (wiki skill, operation record)."
    fail=1
  fi
fi
[ "$fail" -eq 0 ] && echo "knowledge: ok"
exit "$fail"
