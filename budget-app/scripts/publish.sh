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

echo "📋 Running precommit checks..."
npm run precommit

echo "🔨 Building..."
npm run build

echo "📤 Committing and pushing..."
cd ..
git add -A
git diff --cached --quiet || git commit -m "$msg"
git push

echo "✅ Published!"

