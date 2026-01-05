#!/bin/bash

# Pre-deploy automated checks
# Validates code quality before deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/../src"
EXIT_CODE=0

echo "🔍 Running pre-deploy checks..."
echo ""

# =============================================================================
# Check 1: Console.log statements outside allowed files
# =============================================================================
# Note: console.error and console.warn are allowed everywhere for error handling
# Only console.log is restricted to specific logging files:
#   - data/firestore/logger.ts (firestore logging)
#   - utils/actionLogger.ts (user action logging)
#   - hooks/migrations/* (admin migration tools)
#   - pages/budget/admin/* (admin pages)

echo "📋 Checking for rogue console.log statements..."

# Find console.log statements excluding allowed locations
CONSOLE_VIOLATIONS=$(grep -rn "console\.log" "$SRC_DIR" \
  --include="*.ts" --include="*.tsx" \
  | grep -v "data/firestore/logger\.ts" \
  | grep -v "utils/actionLogger\.ts" \
  | grep -v "hooks/migrations/" \
  | grep -v "pages/budget/admin/" \
  || true)

if [ -n "$CONSOLE_VIOLATIONS" ]; then
  echo "❌ Found console.log outside allowed files:"
  echo "$CONSOLE_VIOLATIONS"
  echo ""
  echo "   Allowed locations for console.log:"
  echo "   - data/firestore/logger.ts (Firebase logging)"
  echo "   - utils/actionLogger.ts (User action logging)"
  echo "   - hooks/migrations/* (Migration tools)"
  echo "   - pages/budget/admin/* (Admin pages)"
  echo ""
  echo "   Note: console.error and console.warn are allowed everywhere"
  echo ""
  EXIT_CODE=1
else
  echo "✅ No rogue console.log statements found"
fi

echo ""

# =============================================================================
# Check 2: Deep relative imports (4+ levels should use aliases)
# =============================================================================
echo "📋 Checking for deep relative imports..."

# Find imports with 4+ parent directory traversals (../../../../)
DEEP_IMPORTS=$(grep -rn "from '\.\./\.\./\.\./\.\./" "$SRC_DIR" \
  --include="*.ts" --include="*.tsx" \
  || true)

if [ -n "$DEEP_IMPORTS" ]; then
  echo "❌ Found deep relative imports (use path aliases instead):"
  echo "$DEEP_IMPORTS"
  echo ""
  echo "   Available aliases: @components, @utils, @data, @hooks, @contexts, @styles, @types, @constants, @firestore, @queries, @calculations"
  echo ""
  EXIT_CODE=1
else
  echo "✅ No deep relative imports found"
fi

echo ""

# =============================================================================
# Check 3: Direct imports that bypass barrel files
# =============================================================================
echo "📋 Checking for imports bypassing barrel files..."

# Check for direct imports to ui components (should use @components/ui or ../ui)
BYPASS_VIOLATIONS=$(grep -rn "from '.*components/ui/[A-Z]" "$SRC_DIR" \
  --include="*.ts" --include="*.tsx" \
  | grep -v "/ui/index\.ts" \
  || true)

if [ -n "$BYPASS_VIOLATIONS" ]; then
  echo "⚠️  Found imports bypassing barrel files (use index.ts exports):"
  echo "$BYPASS_VIOLATIONS"
  echo ""
  # Warning only, not blocking
else
  echo "✅ All imports use barrel files correctly"
fi

echo ""

# =============================================================================
# Summary
# =============================================================================
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All pre-deploy checks passed!"
else
  echo "❌ Pre-deploy checks failed. Please fix the issues above."
fi

exit $EXIT_CODE

