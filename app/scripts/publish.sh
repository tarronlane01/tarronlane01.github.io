#!/bin/bash
# Publish script - builds and deploys to GitHub Pages
# Usage: ./scripts/publish.sh "your commit message"

set -e

if [ -z "$1" ]; then
  echo "Error: Please provide a commit message."
  echo "Usage: ./scripts/publish.sh \"your commit message\""
  exit 1
fi

msg="$*"

echo "📋 Running precommit checks (lint, file length)..."
npm run precommit

echo "🔍 Running code quality checks (console statements, imports)..."
bash scripts/review-checks.sh

echo "🔨 Building..."
npm run build

echo "📤 Committing and pushing..."
cd ..
git add -A
git diff --cached --quiet || git commit -m "$msg"
git push

echo "✅ Published!"

