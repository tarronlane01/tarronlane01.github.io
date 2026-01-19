# Let's deploy the code by following these instructions

Deploy using the publish script from the budget-app directory, ensuring commit message is 10 words or less, and captures what was done on this thread.

```bash
cd budget-app && ./scripts/publish.sh "your commit message"
```

The script automatically checks:
- ✅ ESLint passes
- ✅ File line count under limit (400 lines)
- ✅ Code quality checks (console statements, imports, barrel files) - these should already pass from review
- ✅ Build succeeds

**Note:** Code quality checks (console.log violations, deep relative imports, barrel file bypasses) should be run and fixed during the review process (`ai/review.md`). The deploy script runs them again as a safety net.
