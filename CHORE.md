# Deploy

Let's deploy this code with a git message of "Fixed import category balances" using the deploy.sh script. Before doing this, let's make sure all files are under 500 lines, and that we've resolved all build and linter errors.

# Integration Testing
- Organize page files into folder structure matching site URLs (e.g., settings/ for /budget/settings/*, admin/ for /budget/admin/*)
- Make Sure recalc writes happen effciently are won't happen more than once
- make sure all file sizes uner 500
- Make sure build is successful
- make sure if we've changed urls or nav that the nav menus all work correctly (like not showing same page in nav menu if we're on that page)
- Make sure we don't have any loading screens besides the globall oading screen, and we have a standard way to track progress / phases etc
- Remove all console logging except the firebase operations (read/write/query/etc)
- Make sure we have consistent number colors, with positive being red (except category debt which want orange) and positive being green, and zero being grey. Make sure we have the positive or negative sign before the dollar sign. Don't shade the cell green/red, but just keep the striping of the row it's on.
- Make sure we aren't disabling any linting or rules that we should be complying with

## General Architecture Review

You're an expert front-end JavaScript / React / Firebase engineer. Review this project and identify any design flaws applicable to low-user count architecture (max 1-5 users), drawing upon your knowledge of how to reduce complexity and avoid future code maintenance and evolution issues.
- Remove dead code
- Clean up import patterns, with barrel files and Vite path aliases
- Suggest better code organization standards to follow best practices

---

## React Organization

You're a React expert who specializes in organizing React projects to stay under the recommended line counts for their files. Where can this project improve to break things into more modular files without ballooning complexity or traceability? Where can we make use of shareable components to reduce repetition? How can we organize our CSS and styles better to consolidate our styles? Make sure components handle mostly UI logic, with data and other logic moved out into separate hooks. Make components small to keep file size small, breaking out into multiple components when needed.

---

## UI/UX Review

You're a UI expert. How can we improve the usability of this website? What elements are unusual and clunky? What changes can we make to have the site behave how a user will want/expect it to behave?

---

## Firebase Reads/Writes

You're a Firebase expert specializing in making sure our reads/writes are minimal and effective. Make sure all pre-write reads have the pre-write-read comment, and that they bypass the cache. Make sure all other reads DON'T bypass the cache.
- Any doc reads should cache the document
- Any doc reads should check for stale snapshots/flags and resolve them and re-write with resolved data and false for the stale flags
- Any writes should also mark the budget or other month docs as stale if their data would be outdated based on the currently-writing change
- All writes except stale-marking should do a pre-read (bypassing cache) before doing the write, to make sure we're writing latest data

---

## CRUD Organization

You're a CRUD expert for web applications whose goal is to keep things organized, maintainable, and avoid spaghetti CRUD code. All mutations should follow our established pattern in `budget-app/src/data/mutations/`:

**Structure:**
```
data/mutations/
  budget/        # Budget doc mutations
    accounts/      # useUpdateAccounts, useUpdateAccountGroups, useUpdateAccountBalance
    categories/    # useUpdateCategories, useUpdateCategoryGroups
    useRenameBudget.ts
  month/         # Month doc mutations
    income/        # useAddIncome, useUpdateIncome, useDeleteIncome
    expenses/      # useAddExpense, useUpdateExpense, useDeleteExpense
    allocations/   # useSaveDraftAllocations, useFinalizeAllocations, useDeleteAllocations
    useWriteMonthData.ts  # Core write utility (shared by all month mutations)
  user/          # User-related mutations
    useCreateBudget, useAcceptInvite, useInviteUser, useRevokeUser, etc.
  feedback/      # Feedback mutations
    useSubmitFeedback, useToggleFeedback, useUpdateSortOrder
  payees/        # Payee mutations
    savePayeeIfNew
```

**Rules:**
- **One file per operation** (e.g., `useAddIncome.ts`, `useUpdateAccounts.ts`) - filename should clearly indicate what it does
- **No combiner hooks** - Import individual hooks directly where needed, don't create wrapper hooks that aggregate multiple mutations
- **Month mutations** use `useWriteMonthData` for the core write which handles cascade marking of future months/budget
- **Pre-write reads** use `readMonthForEdit()` for month documents, or `readDocByPath` with 'PRE-EDIT-READ' description for others
- **Vite aliases** - Use `@data`, `@types`, `@firestore`, `@utils` etc. instead of relative paths

---

## Firebase Security Rules

You're a Firebase expert, making sure my Firebase rules handle security for this app, making sure unauthorized users aren't able to create/edit/read any data they shouldn't.

---

## User Action Tracing Audit

You're helping maintain the user action tracing system for AI-assisted debugging. The goal is to log user interactions to the console so that when errors occur, the user can copy/paste console output to show the AI exactly what actions led up to the error.

**Feature flag:** `featureFlags.logUserActions` in `@constants/featureFlags`

**Core utility:** `@utils/actionLogger.ts` provides:
- `logUserAction(type, name, context?)` - Direct logging function
- `trackedClick(name, onClick, options?)` - Wrapper for click handlers
- `trackedChange(name, onChange, options?)` - Wrapper for value change handlers
- `trackedInputChange(name, onChange, options?)` - Wrapper for input event handlers
- `trackedSubmit(name, onSubmit, options?)` - Wrapper for form submissions

**Built-in component support:**
- `<Button actionName="...">` - Auto-logs clicks when actionName provided
- `<FormWrapper actionName="...">` - Auto-logs form submissions when actionName provided

**Audit checklist:**
1. All `<Button>` components with meaningful actions should have `actionName` props
2. All `<FormWrapper>` components should have `actionName` props
3. Important form field changes should use `trackedChange` or `trackedInputChange`
4. Modal opens/closes, navigation, and toggles should call `logUserAction` directly
5. Action names should be descriptive: "Save Budget", "Delete Category", not just "Click"

**Console output format:**
```
[14:32:05.123] [User] CLICK: Save Budget
[14:32:06.456] [User] CHANGE: Amount = "$500"
[14:32:07.789] [User] SUBMIT: Add Income Form
```

**Action types:** CLICK, CHANGE, SUBMIT, SELECT, TOGGLE, EXPAND, COLLAPSE, NAVIGATE, OPEN, CLOSE

