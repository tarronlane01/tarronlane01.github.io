# Deploy

Let's deploy this code with a one sentence git message reflecting high-level (summary, not-specific, not verbose, max 10 words) what we did, using the deploy.sh script, after making sure we're compliant with the following:

- build is successful
- file line count under limit
- linter is successful
- barrel files and vite path aliases for imports
- no console prints except the firestore read/write/query built-in-logging
- Remove any dead code