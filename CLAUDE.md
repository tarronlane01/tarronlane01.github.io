# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React 19 + TypeScript + Vite budget management SPA, deployed to GitHub Pages. Uses Firebase for auth and Firestore for data, React Query for async state/caching. All source code lives in `budget-app/`.

## Commands

All commands run from the `budget-app/` directory:

```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # TypeScript check + Vite production build (outputs to ../docs)
npm run lint         # ESLint (strict — must pass with zero warnings)
npm run precommit    # lint:file-length + lint

# Review checks (run from repo root OR budget-app/):
bash budget-app/scripts/review-checks.sh
# Checks: file length ≤400 lines, color constants, console.log placement,
#          deep relative imports, barrel file bypasses

# Deploy (from budget-app/):
./scripts/publish.sh "commit message (10 words or less)"
# Runs: precommit → review-checks → build → git commit → git push
```

## Architecture

### Layered data flow (enforced by ESLint `no-restricted-imports`)

```
Components/Pages → Hooks → React Query (queries/mutations) → Firestore operations → Firebase SDK
```

- **Components** (`src/components/`, `src/pages/`) import hooks, never data layer directly
- **Hooks** (`src/hooks/`) import from `@data`, never from `@firestore`
- **Data layer** (`src/data/`) — queries, mutations, recalculation, cached reads. See `src/data/index.ts` for architecture docs
- **Firestore operations** (`src/data/firestore/`) — only place that imports `firebase/*` directly

### Minimal context pattern

- **BudgetContext** — selection state only (budgetId, year, month, tab)
- **AppContext** — global loading overlay holds + notification banner queue
- **UserContext** — auth state
- All domain data flows through React Query hooks, not context or props

### Key patterns

- **Loading:** All initial page content uses global `LoadingOverlay` via `addLoadingHold(id, message)` / `removeLoadingHold(id)`. No per-component loaders.
- **Errors:** Abbreviated message in bottom banner (via `bannerQueue`), full error in console.
- **Colors:** Single source of truth in `src/constants/colors.ts`. Every color has `{ light, dark }`. No raw hex/rgba elsewhere (enforced by `check-colors.cjs`).
- **Recalculation:** Balance recalc engine in `src/data/recalculation/`. Use `triggerRecalculation()` for on-demand updates. See "Balance storage and on-the-fly window" below.
- **Minimize Firestore reads/writes:** Every Firestore operation costs money. Prefer reading from React Query cache (`cachedReads.ts`) over issuing new Firestore fetches. Batch related writes into a single operation when possible. Avoid re-fetching data that's already cached — use query invalidation to trigger refetches only when data has actually changed. When designing new features, consider whether existing cached data can serve the need before adding new reads.

### Balance storage and on-the-fly window

The app uses a rolling window to decide what gets persisted to Firestore vs computed on-the-fly. The window starts `MAX_PAST_MONTHS` (3) months before the current calendar month. See `src/utils/window.ts`.

**How month balances load:**
1. Months **at or before the window start** (old months): `start_balance` is persisted to Firestore. Their previous month may not be in memory, so the stored value is the source of truth.
2. Months **after the window start** (recent, current, and future): `start_balance` is NOT persisted (stored as `0`). Balances are computed on-the-fly from the previous month's end balances — either during `createMonth` (for the React Query cache) or during recalculation (`triggerRecalculation`).
3. Calculated fields (`end_balance`, `net_change`, `income`, `expenses`, `transfers`, `adjustments`, `spent`, `allocated`) are always computed on-the-fly from transaction arrays, never read from Firestore. Converters in `src/data/firestore/converters/monthBalances.ts` handle this when reading from Firestore.

**Rules (must follow when fixing bugs or adding features):**
- **Never persist `start_balance` to Firestore for months after the window start.** Use `isMonthAtOrBeforeWindow()` to check.
- **The React Query cache is the source of truth for recent/future month balances**, not Firestore. When creating or updating months after the window, always set correct balances in the cached MonthDocument.
- **Compute, don't store.** If a balance value can be derived from the previous month + current transactions, compute it on-the-fly rather than saving it. This avoids stale data and keeps the system consistent.
- Firestore converters (`calculatedToStoredAccountBalance`, `calculatedToStoredCategoryBalance`) enforce the window rule when writing. `createMonth` enforces it separately for initial month creation.

### Path aliases (defined in tsconfig + vite.config.ts)

`@constants`, `@utils`, `@data`, `@hooks`, `@contexts`, `@components`, `@firestore`, `@queries`, `@types`, `@styles`, `@calculations`

## Code Quality Rules

- **Max 400 lines** per `.ts`/`.tsx` file. Shorten by modularizing, not stripping comments.
- **`console.log`** only allowed in: `data/firestore/logger.ts`, `utils/actionLogger.ts`, `hooks/migrations/*`, `pages/budget/admin/*`. Use `console.error`/`console.warn` elsewhere.
- **Imports 4+ levels deep** (`../../../../`) must use path aliases.
- **Barrel file imports required** — use `from '@components/ui'` not `from '@components/ui/Modal'`.
- **Feature flags** in `src/constants/featureFlags.ts` control debug logging (Firebase ops, user actions, etc.).

## Review Checklist (before deploy)

1. Loading uses global overlay pattern
2. Remove dead code
3. Code conforms to established patterns
4. Changes account for desktop and mobile views
5. Errors shown via bottom banner system
6. `bash budget-app/scripts/review-checks.sh` passes
7. `npm run lint` and `npm run build` pass with zero warnings

## Deployment

GitHub Pages from `main` branch, `/docs` folder. Uses spa-github-pages pattern (`public/404.html` redirects for client-side routing).
