# Deploy: Publish via script

Deploy by running the publish script from the app directory.

**Requirements:**
- Use a commit message of **10 words or less** that captures what was done in this thread.
- Run from the app directory:

```bash
cd app && ./scripts/publish.sh "your commit message"
```

The script automatically checks:
- ESLint passes
- File line count under limit (400 lines)
- Code quality checks (console statements, imports, barrel files) – these should already pass from review
- Build succeeds

**Note:** Code quality checks (console.log violations, deep relative imports, barrel file bypasses) should be run and fixed during the review process (run the **Review** command first). The deploy script runs them again as a safety net.
