#!/usr/bin/env bash
# Repo hygiene guard (plan §13): fail if AI-attribution terms appear in tracked
# files or in this branch's commit messages. Wordlist is deliberately specific
# to avoid false positives on legitimate domain text (no bare "ai"/"ml").
set -euo pipefail

# Case-insensitive ERE. Tuned: tool/vendor names + attribution phrases only.
PATTERN='claude|copilot|chatgpt|gpt-?[0-9]|openai|anthropic|co-authored-by:[[:space:]]*.*(claude|copilot|gpt|bot)|generated with|ai-assisted|ai-generated|written by ai'

fail=0

# 1. Tracked files. Exclude this script (it necessarily contains the words),
#    lockfiles, and the vendored Pyodide runtime (third-party WASM/manifest;
#    sha256 hashes + package names coincidentally match — same rationale as
#    lockfiles, this is not authored content).
echo "Scanning tracked files…"
while IFS= read -r f; do
  case "$f" in
    scripts/check_no_attribution.sh) continue ;;
    *package-lock.json|*.lock) continue ;;
    frontend/public/pyodide/*) continue ;;
  esac
  if grep -EniH "$PATTERN" -- "$f" 2>/dev/null; then
    fail=1
  fi
done < <(git ls-files)

# 2. Commit messages unique to this branch (not on origin/main).
base="origin/main"
if git rev-parse --verify "$base" >/dev/null 2>&1; then
  echo "Scanning branch commit messages vs ${base} ..."
  if git log "$base"..HEAD --format='%H %s%n%b' | grep -Eni "$PATTERN"; then
    fail=1
  fi
fi

if [ "$fail" -ne 0 ]; then
  echo "::error::AI-attribution terms found. Remove them before pushing (plan §13)."
  exit 1
fi
echo "Clean — no attribution terms found."
