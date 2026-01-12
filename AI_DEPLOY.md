# Deploy

**Manual review before deploying:**
- Remove any dead code introduced in this session
- Restruture any code that should conform to newly created patterns or systems
- Make sure all changes work well on desktop and mobile

**Then**
Deploy using the publish script from the budget-app directory, ensuring commit message is 10 words or less:

```bash
cd budget-app && ./scripts/publish.sh "your commit message"
```

The script automatically checks:
- ✅ ESLint passes
- ✅ File line count under limit (400 lines)
- ✅ No rogue console statements (only allowed in logging/admin files)
- ✅ No deep relative imports (use path aliases)
- ✅ Build succeeds
