# Let's deploy the code by following these instructions

Deploy using the publish script from the budget-app directory, ensuring commit message is 10 words or less, and captures what was done on this thread.

```bash
cd budget-app && ./scripts/publish.sh "your commit message"
```

The script automatically checks:
- ✅ ESLint passes
- ✅ File line count under limit (400 lines)
- ✅ No rogue console statements (only allowed in logging/admin files)
- ✅ No deep relative imports (use path aliases)
- ✅ Build succeeds
