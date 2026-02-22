# Debug: Add console output to identify the bug

Help me add minimal, focused console logging so we can:

1. **Identify the issue** – Log the exact values and control flow where the bug manifests (e.g. before/after a suspicious line, inside a condition, at the start of a handler).
2. **Fit on one screen** – Keep total debug output short enough to fit in a single browser DevTools console view so it can be copied in one go and pasted to the AI.
3. **Single-focus console** – Clean up other debug output so we only see output related to this bug. Temporarily disable Firebase read/write logging by setting `logFirebaseOperations` to `false` in `budget-app/src/constants/featureFlags.ts` (add a `// DEBUG: revert after fixing bug` comment so it gets turned back on later). Remove or comment out any other existing console logs in the code paths we’re debugging unless they are directly relevant.
4. **Pinpoint the cause** – From the output, we should be able to say what is wrong (wrong value, wrong branch, wrong order, missing data, etc.) and then fix it.
5. **Show cause and effect** – Log **every user action** related to the problem to the console in plain language (e.g. “User clicked ‘Save’ button”, “User selected month March 2025”). This makes it easy to see the sequence of actions that led to the bug.
6. **Show app intent** – Log in **plain language** everything the app is trying to do (e.g. “Fetching budget for month …”, “Recalculating category balances”, “Saving transaction”). Scanning the console at any time should show what the app is attempting at that moment.

## Guidelines for the debug logging you add

- **One clear label per log** – Use a short, unique prefix (e.g. `[DEBUG]`, `[BUG]`) so we can grep or spot logs quickly.
- **User actions** – At each relevant UI handler (click, change, submit), log a single plain-language line describing the action (e.g. “User clicked X button”, “User changed category to Y”).
- **App intent** – At the start of important flows (queries, mutations, recalculations, navigation), log a single plain-language line describing what the app is doing (e.g. “App is trying to load budget …”, “App is saving …”).
- **Log only what’s needed** – Relevant variables, key object fields, and maybe one line indicating which branch or function ran. Avoid logging huge objects or entire lists unless necessary; log summaries or single fields instead.
- **Avoid re-render spam** – Do not put logs in component bodies, hooks, or other code that runs on every re-render, unless we are specifically debugging re-renders. Prefer logging inside event handlers, effect callbacks (when the effect has meaningful deps), or one-off code paths so the console stays readable.
- **Structured for copy-paste** – Prefer a few `console.log` lines that print compact, readable lines (e.g. `key: value` or short JSON) rather than deep nested dumps.
- **Temporary** – Add comments so we know these logs are for debugging and can be removed once the bug is fixed.
- **Single-focus console** – Before adding new logs, temporarily set `logFirebaseOperations: false` in `budget-app/src/constants/featureFlags.ts` (with a `// DEBUG: revert after fixing bug` comment). Remove or comment out any other `console.log`/warn/error in the code paths we’re debugging so the console only shows output for this bug.

## What to produce

1. Clean up the console first: set `logFirebaseOperations` to `false` in `featureFlags.ts` (with the DEBUG revert comment), and remove or comment out other debug logs in the relevant code paths.
2. Add the minimal set of `console.log` (or `console.warn` / `console.error` where appropriate) statements that will show the bug, including:
   - **User-action logs** – Plain-language lines for every relevant user action (e.g. clicked X, selected Y) so cause-and-effect is visible in the console.
   - **App-intent logs** – Plain-language lines for what the app is doing at key moments (e.g. fetching, saving, recalculating) so scanning the console shows what is being attempted at any time.
3. Tell me exactly where you added them (file and line/area).
4. Describe what to do in the app to reproduce and what to copy from the console.
5. After I paste the console output back, analyze it and state the **cause of the bug** in one or two sentences, then suggest the fix.
