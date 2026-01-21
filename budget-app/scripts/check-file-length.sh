#!/bin/bash

# Check for files over 400 lines in the src directory
# Used as a pre-commit hook to enforce file size limits
# Works correctly regardless of where it's called from

MAX_LINES=400
EXIT_CODE=0

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the budget-app directory (parent of scripts directory)
BUDGET_APP_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$BUDGET_APP_DIR/src"

# Verify src directory exists
if [ ! -d "$SRC_DIR" ]; then
  echo "❌ Error: src directory not found at $SRC_DIR"
  exit 1
fi

echo "Checking for files over $MAX_LINES lines in $SRC_DIR..."

# Find all .ts and .tsx files in src directory
FILES_FOUND=0
while IFS= read -r file; do
  if [ -f "$file" ]; then
    FILES_FOUND=1
    lines=$(wc -l < "$file" | tr -d ' ')
    if [ "$lines" -gt "$MAX_LINES" ]; then
      # Show relative path from budget-app directory
      rel_path="${file#$BUDGET_APP_DIR/}"
      echo "❌ $rel_path: $lines lines (max: $MAX_LINES)"
      EXIT_CODE=1
    fi
  fi
done < <(find "$SRC_DIR" \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null)

# Fail if no files were found (indicates script is broken or wrong directory)
if [ $FILES_FOUND -eq 0 ]; then
  echo "❌ Error: No TypeScript files found in $SRC_DIR"
  echo "   This likely means the script is looking in the wrong directory."
  exit 1
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All files are under $MAX_LINES lines"
fi

exit $EXIT_CODE

