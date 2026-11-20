#!/usr/bin/env bash
# Tests .github/scripts/wiki-index.mjs: index generated from article front matter,
# sorted, planned concepts dashed, stale index and bad front matter fail with FAIL lines.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/.github/scripts/wiki-index.mjs"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
mkdir -p "$W/product" "$W/architecture"
cat > "$W/product/zebra.md" <<'MD'
---
summary: Zebra summary
concepts:
  - name: Zebra
    code: api/src/zebra.ts
    relates: eats Grass
---
# Zebra

text
MD
cat > "$W/product/grass.md" <<'MD'
---
summary: Grass summary
concepts:
  - name: Grass
    status: planned
---
# Grass
MD
cat > "$W/architecture/api.md" <<'MD'
---
summary: API summary
---
# API
MD
fail=0
t() { echo "FAIL $1"; fail=1; }
node "$S" --root "$W" >/dev/null || t "W1: generate failed"
idx="$W/index.md"
grep -q '^| \[Grass\](product/grass.md) | Grass summary |$' "$idx" || t "W2: article row"
[ "$(grep -n 'product/grass.md) | Grass' "$idx" | cut -d: -f1)" -lt "$(grep -n 'product/zebra.md) | Zebra' "$idx" | cut -d: -f1)" ] || t "W3: rows not sorted"
grep -q '  Zebra -.->|eats| Grass' "$idx" || t "W4: edge to a planned concept must be dashed"
grep -q '^| Grass (planned) | \[Grass\](product/grass.md) | none (planned) | Zebra |$' "$idx" || t "W5: planned concept row"
grep -q '^| Zebra | \[Zebra\](product/zebra.md) | `api/src/zebra.ts` | Grass |$' "$idx" || t "W6: concept row"
grep -A4 '^## design' "$idx" | grep -q 'No articles yet.' || t "W7: empty topic"
node "$S" --root "$W" --check >/dev/null || t "W8: fresh index must pass the check"
echo "edited by hand" >> "$idx"
out=$(node "$S" --root "$W" --check); [ $? -ne 0 ] && echo "$out" | grep -q '^FAIL wiki-index' || t "W9: stale index must fail with a FAIL line"
node "$S" --root "$W" >/dev/null
sed -i.bak 's/eats Grass/eats Hay/' "$W/product/zebra.md"; rm -f "$W/product/zebra.md.bak"
out=$(node "$S" --root "$W"); [ $? -ne 0 ] && echo "$out" | grep -q 'unknown concept' || t "W10: unknown relation target must fail"
sed -i.bak 's/eats Hay/eats Grass/' "$W/product/zebra.md"; rm -f "$W/product/zebra.md.bak"
printf '# No front matter\n' > "$W/product/bare.md"
out=$(node "$S" --root "$W"); [ $? -ne 0 ] && echo "$out" | grep -q 'bare.md: no front matter' || t "W11: missing front matter must fail"
rm "$W/product/bare.md"
mkdir -p "$W/misc"; printf -- '---\nsummary: x\n---\n# X\n' > "$W/misc/x.md"
out=$(node "$S" --root "$W"); [ $? -ne 0 ] && echo "$out" | grep -q 'not in a known topic' || t "W12: unknown topic must fail"
[ "$fail" -eq 0 ] && echo "wiki-index: ok"
exit "$fail"
