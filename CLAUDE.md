# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React 19 + TypeScript + Vite multi-app SPA, deployed to GitHub Pages. Uses Firebase for auth and Firestore for data, React Query for async state/caching. All source code lives in `app/`.

The app supports multiple "apps" via routing within a single Vite build. Shared infrastructure (auth, Firebase, UI components) lives in `src/shared/`, while app-specific code lives in `src/apps/<app-name>/`.

Currently contains one app: **Budget** (`src/apps/budget/`).

## Commands

All commands run from the `app/` directory:

```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # TypeScript check + Vite production build (outputs to ../docs)
npm run lint         # ESLint (strict — must pass with zero warnings)
npm run precommit    # lint:file-length + lint

# Review checks (run from repo root OR app/):
bash app/scripts/review-checks.sh
# Checks: file length ≤400 lines, color constants, console.log placement,
#          deep relative imports, barrel file bypasses

# Deploy (from app/):
./scripts/publish.sh "commit message (10 words or less)"
# Runs: precommit → review-checks → build → git commit → git push
```

## Architecture

### Directory structure

```
app/src/
├── shared/                    # Cross-app infrastructure
│   ├── components/            # Shared UI (Button, Modal, Form, Banner, etc.)
│   ├── contexts/              # AppContext, UserContext
│   ├── hooks/                 # useFirebaseAuth, useIsMobile, useScreenWidth
│   ├── data/                  # queryClient, QueryProvider, Firestore operations
│   │   └── firestore/         # Firebase init, Firestore ops, logger
│   ├── constants/             # colors, breakpoints, featureFlags, auth, date
│   ├── styles/                # shared.ts
│   ├── utils/                 # currency, date, actionLogger, calculations
│   └── types/                 # type_user_context, type_firebase_auth_hook
│
├── apps/
│   └── budget/                # Budget app
│       ├── components/        # Budget UI (BudgetLayout, BudgetNavBar, Admin, etc.)
│       ├── contexts/          # BudgetContext
│       ├── hooks/             # useBudgetData, useMonthData, migrations, etc.
│       ├── data/              # queries, mutations, recalculation, cachedReads
│       ├── pages/             # Budget, Analytics, MyBudgets, Settings, Admin
│       ├── types/             # Budget Firestore document types
│       └── BudgetApp.tsx      # Budget route tree + BudgetProvider wrapper
│
├── pages/                     # Top-level pages (Home, Account)
├── App.tsx                    # Root: shared providers + route dispatch
├── main.tsx
└── index.css
```

### Layered data flow (enforced by ESLint `no-restricted-imports`)

```
Components/Pages → Hooks → React Query (queries/mutations) → Firestore operations → Firebase SDK
```

- **Components** (`src/shared/components/`, `src/apps/budget/components/`, `src/pages/`) import hooks, never data layer directly
- **Hooks** (`src/shared/hooks/`, `src/apps/budget/hooks/`) import from `@data` or `@budget/data`, never from `@firestore`
- **Data layer** (`src/shared/data/`, `src/apps/budget/data/`) — queries, mutations, recalculation, cached reads
- **Firestore operations** (`src/shared/data/firestore/`) — only place that imports `firebase/*` directly

### Minimal context pattern

- **BudgetContext** (`@budget/contexts`) — selection state only (budgetId, year, month, tab)
- **AppContext** (`@contexts`) — global loading overlay holds + notification banner queue
- **UserContext** (`@contexts`) — auth state
- All domain data flows through React Query hooks, not context or props

### Key patterns

- **Loading:** All initial page content uses global `LoadingOverlay` via `addLoadingHold(id, message)` / `removeLoadingHold(id)`. No per-component loaders.
- **Errors:** Abbreviated message in bottom banner (via `bannerQueue`), full error in console.
- **Colors:** Single source of truth in `src/shared/constants/colors.ts`. Every color has `{ light, dark }`. No raw hex/rgba elsewhere (enforced by `check-colors.cjs`).
- **Recalculation:** Balance recalc engine in `src/apps/budget/data/recalculation/`. Use `triggerRecalculation()` for on-demand updates. See "Balance storage and on-the-fly window" below.
- **Minimize Firestore reads/writes:** Every Firestore operation costs money. Prefer reading from React Query cache (`cachedReads.ts`) over issuing new Firestore fetches. Batch related writes into a single operation when possible. Avoid re-fetching data that's already cached — use query invalidation to trigger refetches only when data has actually changed. When designing new features, consider whether existing cached data can serve the need before adding new reads.

### Balance storage and on-the-fly window

The app uses a rolling window to decide what gets persisted to Firestore vs computed on-the-fly. The window starts `MAX_PAST_MONTHS` (3) months before the current calendar month. See `src/shared/utils/window.ts`.

**How month balances load:**
1. Months **at or before the window start** (old months): `start_balance` is persisted to Firestore. Their previous month may not be in memory, so the stored value is the source of truth.
2. Months **after the window start** (recent, current, and future): `start_balance` is NOT persisted (stored as `0`). Balances are computed on-the-fly from the previous month's end balances — either during `createMonth` (for the React Query cache) or during recalculation (`triggerRecalculation`).
3. Calculated fields (`end_balance`, `net_change`, `income`, `expenses`, `transfers`, `adjustments`, `spent`, `allocated`) are always computed on-the-fly from transaction arrays, never read from Firestore. Converters in `src/apps/budget/data/converters/monthBalances.ts` handle this when reading from Firestore.

**Rules (must follow when fixing bugs or adding features):**
- **Never persist `start_balance` to Firestore for months after the window start.** Use `isMonthAtOrBeforeWindow()` to check.
- **The React Query cache is the source of truth for recent/future month balances**, not Firestore. When creating or updating months after the window, always set correct balances in the cached MonthDocument.
- **Compute, don't store.** If a balance value can be derived from the previous month + current transactions, compute it on-the-fly rather than saving it. This avoids stale data and keeps the system consistent.
- Firestore converters (`calculatedToStoredAccountBalance`, `calculatedToStoredCategoryBalance`) enforce the window rule when writing. `createMonth` enforces it separately for initial month creation.

### Path aliases (defined in tsconfig + vite.config.ts)

**Shared aliases:**
`@constants`, `@utils`, `@data`, `@hooks`, `@contexts`, `@components`, `@firestore`, `@types`, `@styles`, `@calculations`

**App-specific aliases:**
`@budget` → `src/apps/budget/`

### How to add a new app

1. Create `src/apps/<name>/` with subdirs: `components/`, `hooks/`, `data/`, `pages/`
2. Create `src/apps/<name>/<Name>App.tsx` with app-specific providers and routes
3. Add `@<name>` path alias to `vite.config.ts` and `tsconfig.app.json`
4. Add route in `src/App.tsx`: `<Route path="/<name>/*" element={<ProtectedRoute />}><Route path="*" element={<NameApp />} /></Route>`
5. Add link on Home page
6. If auth-protected, wrap with `<ProtectedRoute />`

## Code Quality Rules

- **Max 400 lines** per `.ts`/`.tsx` file. Shorten by modularizing, not stripping comments.
- **`console.log`** only allowed in: `data/firestore/logger.ts`, `utils/actionLogger.ts`, `hooks/migrations/*`, `pages/admin/*`. Use `console.error`/`console.warn` elsewhere.
- **Imports 4+ levels deep** (`../../../../`) must use path aliases.
- **Barrel file imports required** — use `from '@components/ui'` not `from '@components/ui/Modal'`.
- **Feature flags** in `src/shared/constants/featureFlags.ts` control debug logging (Firebase ops, user actions, etc.).

## Review Checklist (before deploy)

1. Loading uses global overlay pattern
2. Remove dead code
3. Code conforms to established patterns
4. Changes account for desktop and mobile views
5. Errors shown via bottom banner system
6. `bash app/scripts/review-checks.sh` passes
7. `npm run lint` and `npm run build` pass with zero warnings

## Deployment

GitHub Pages from `main` branch, `/docs` folder. Uses spa-github-pages pattern (`public/404.html` redirects for client-side routing).
