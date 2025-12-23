#!/bin/bash

# Install git pre-commit hook for file length validation
# Run this script once to set up the hook

HOOK_DIR="../../.git/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"

# Create the pre-commit hook
cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash

# Pre-commit hook for budget-app
# Checks that no TypeScript files exceed 500 lines

cd budget-app

# Run the file length check
npm run lint:file-length

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Pre-commit check failed: Some files exceed 500 lines."
  echo "Please split large files into smaller components before committing."
  exit 1
fi

echo "✅ Pre-commit checks passed"
exit 0
EOF

chmod +x "$HOOK_FILE"

echo "✅ Git pre-commit hook installed successfully!"
echo "The hook will run 'npm run lint:file-length' before each commit."

