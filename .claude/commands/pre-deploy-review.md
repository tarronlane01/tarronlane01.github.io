# Review: Pre-merge checklist

Walk through each step below to confirm the change is ready. Fix any issues found before proceeding.

1. **Loading** – Confirm all loading of initial page content uses the global loading overlay with the associated loading hold pattern, instead of using separate overlays, separate load state, or content loading after the page is already showing.
2. **Dead code** – Remove any dead code introduced in this session.
3. **Patterns** – Restructure any code that should conform to newly created patterns or systems.
4. **Responsive** – Ensure all changes account for desktop vs mobile views.
5. **Errors** – Ensure all errors are shown via the common bottom banner system (abbreviated), with the full error message in the console.
6. **Review checks** – Run review checks and fix any issues:
   - Run `bash app/scripts/review-checks.sh` from the repo root (or `bash scripts/review-checks.sh` from the app directory). It checks:
     - File length (no .ts/.tsx over 400 lines). Shorten files by modularizing code, not by stripping comments or useful information.
     - Theme colors (no raw hex/rgba outside `src/shared/constants/colors.ts` and `src/index.css`; every color in constants must have light and dark).
     - Rogue console.log statements (outside allowed files).
     - Deep relative imports (4+ levels – should use path aliases).
     - Imports bypassing barrel files (should use index.ts exports).
   - Fix all violations before proceeding.
7. **Lint and build** – Ensure lint and build complete successfully with no errors and all warnings resolved:
   - Run `cd app && npm run lint` to catch ESLint errors and warnings.
   - Run `cd app && npm run build` to catch anything from the build process that should be addressed.
   - Fix all warnings, even if they weren't introduced in this session. This includes `@typescript-eslint/no-explicit-any` – properly type the code or add eslint-disable comments with justification.
