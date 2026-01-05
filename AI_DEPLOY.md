# Deploy

Deploy using the publish script from the budget-app directory:

```bash
cd budget-app && ./scripts/publish.sh "your commit message"
```

The script automatically checks:
- ✅ ESLint passes
- ✅ File line count under limit (400 lines)
- ✅ No rogue console statements (only allowed in logging/admin files)
- ✅ No deep relative imports (use path aliases)
- ✅ Build succeeds

**Manual review before deploying:**
- Remove any dead code introduced in this session