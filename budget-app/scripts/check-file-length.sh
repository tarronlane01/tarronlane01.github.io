#!/bin/bash

# Check for files over 500 lines in the src directory
# Used as a pre-commit hook to enforce file size limits

MAX_LINES=500
EXIT_CODE=0

echo "Checking for files over $MAX_LINES lines..."

# Find all .ts and .tsx files in src directory
while IFS= read -r file; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file" | tr -d ' ')
    if [ "$lines" -gt "$MAX_LINES" ]; then
      echo "❌ $file: $lines lines (max: $MAX_LINES)"
      EXIT_CODE=1
    fi
  fi
done < <(find ./src -name "*.ts" -o -name "*.tsx" 2>/dev/null)

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All files are under $MAX_LINES lines"
fi

exit $EXIT_CODE

