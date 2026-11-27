#!/bin/sh
# [SECTION=audit] rev.sh <commit> <name>: exports that commit's sources (no worktree)
# and builds the full admin page into out/<name>.
set -e
H=$(cd "$(dirname "$0")" && pwd); REPO=$(cd "$H/../.." && pwd)
SRC="${TMPDIR:-/tmp}/ui-proof-src-$2"
rm -rf "${SRC:?}"; mkdir -p "$SRC"
git -C "$REPO" archive "$1" apps/web apps/shared packages/design-tokens apps/convex/src/_generated package.json | tar -x -C "$SRC"
for d in . apps/web; do ln -s "$REPO/$d/node_modules" "$SRC/$d/node_modules"; done
node "$H/build.cjs" "$SRC" "$H/out/$2" | tail -1
