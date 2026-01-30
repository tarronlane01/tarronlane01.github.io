# AI Instructions to Follow

Okay I think this change is ready to go. Let's check the things we need to make sure conform to our standards before we can call the code done.

When pointed to this file, AI should do the following:

1. Confirm all loading of initial page content uses the global loading overlay with the associated loading hold pattern, instead of using separate overlays, using separate load state, or having content load after the page is already showing.
2. Remove any dead code introduced in this session
3. Restructure any code that should conform to newly created patterns or systems
4. Make sure all changes have accounted for desktop vs mobile views
5. Make sure all errors are shown via the common bottom banner system (abbreviated) with the full error message being shown in the console
6. Run review checks and fix any issues:
   - Run `bash budget-app/scripts/review-checks.sh` from the repo root (or `bash scripts/review-checks.sh` from the budget-app directory). This runs:
     - File length (no .ts/.tsx over 400 lines) Shorten files by modularizing code, not by stripping comments or useful information.
     - Theme colors (no raw hex/rgba outside `src/constants/colors.ts` and `src/index.css`; every color in constants must have light and dark)
     - Rogue console.log statements (outside allowed files)
     - Deep relative imports (4+ levels - should use path aliases)
     - Imports bypassing barrel files (should use index.ts exports)
   - Fix all violations before proceeding
7. Make sure that the lint and build completes successfully without errors and that all warnings are resolved
   - Run `npm run lint` in the budget-app directory to catch ESLint errors or warnings (not just TypeScript diagnostics)
   - The `read_lints` tool may miss some ESLint rules, so always verify with the actual lint command
   - Run `npm run build` to catch anything from the build process that should be addressed
   - Fix all warnings, even if they weren't introduced in this session. This includes `@typescript-eslint/no-explicit-any` warnings - properly type the code or add eslint-disable comments with justification.