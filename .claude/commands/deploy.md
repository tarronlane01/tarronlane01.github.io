# Deploy: Publish via script

Deploy by running the publish script from the app directory.

## Steps

1. Generate a commit message of **10 words or less** that captures the changes. If `$ARGUMENTS` is provided, use that as the commit message instead.
2. Show the commit message and ask the user to confirm before proceeding.
3. Run the publish script:

```bash
cd app && ./scripts/publish.sh "your commit message"
```

The script automatically runs precommit checks, code quality checks, builds, commits, and pushes. If any step fails, fix the issue and re-run.

**Note:** Code quality checks should already pass from the review process. Run `/pre-deploy-review` first if you haven't already.
