#!/usr/bin/env bash
# One-time local git setup. Run from the repo root AFTER creating an empty repo on GitHub.
# Usage: bash scripts/git-setup.sh <remote-url>
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE="${1:?Usage: bash scripts/git-setup.sh <remote-url>}"

git init -b main
git add .
git commit -m "chore: initial project scaffold"
git remote add origin "$REMOTE"
git push -u origin main

# starter branches, one per person
git checkout -b feat/auth-jaanhavi && git push -u origin feat/auth-jaanhavi
git checkout main
git checkout -b feat/services-kushi && git push -u origin feat/services-kushi
git checkout main
echo "Done. Jaanhavi: git checkout feat/auth-jaanhavi | Kushi: git checkout feat/services-kushi"
