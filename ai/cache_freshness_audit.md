# Cache Freshness Audit Report

## Summary
Found one issue where `readMonthDirect` bypasses cache freshness checks. All other cache usage is correct.

## ✅ Working Correctly

### 1. React Query Configuration
- **File**: `queryClient.ts`
- **Status**: ✅ **CORRECT**
- **Details**:
  - `staleTime: 5 minutes` - data considered fresh for 5 minutes
  - `refetchOnMount: true` - refetches when component mounts if data is stale
  - `refetchOnReconnect: true` - refetches on reconnect
  - All queries (`useMonthQuery`, `useBudgetQuery`, `usePayeesQuery`) set `staleTime: STALE_TIME`

### 2. Query Hooks
- **Files**: `useMonthQuery.ts`, `useBudgetQuery.ts`, `usePayeesQuery.ts`
- **Status**: ✅ **CORRECT**
- **Details**:
  - All use `useQuery` with `staleTime: STALE_TIME`
  - React Query automatically refetches when data is stale or missing
  - `refetchOnMount: true` ensures stale data is refetched when component mounts

### 3. readMonth Function
- **File**: `readMonth.ts`
- **Status**: ✅ **CORRECT**
- **Details**:
  - Uses `queryClient.fetchQuery` which respects `staleTime`
  - Automatically refetches if cache is stale or missing
  - Used by `ensureMonthsFreshAndRecalculateBalances` to refetch stale months

### 4. ensureMonthsFreshAndRecalculateBalances
- **File**: `ensureMonthsFresh.ts`
- **Status**: ✅ **CORRECT**
- **Details**:
  - Checks cache freshness using `getQueryState` and `dataUpdatedAt`
  - Refetches stale/missing months using `readMonth` (which uses `fetchQuery`)
  - Called before balance recalculation functions

### 5. Balance Recalculation Functions
- **Files**: `recalculateBudgetCategoryBalancesFromCache.ts`, `recalculateBudgetAccountBalancesFromCache.ts`
- **Status**: ✅ **CORRECT** (with assumption)
- **Details**:
  - Use `getQueryData` directly (assumes data is fresh)
  - **BUT**: These are only called AFTER `ensureMonthsFreshAndRecalculateBalances` ensures freshness
  - Comment says "Assumes all required months are already in cache and fresh" - this is satisfied by calling `ensureMonthsFreshAndRecalculateBalances` first

## ✅ All Issues Fixed

### 1. Fixed: readMonthDirect Bypassing Cache Freshness
- **File**: `useLocalRecalculation.ts` → `getPreviousMonthSnapshot`
- **Issue**: Was using `readMonthDirect` which always reads from Firestore, bypassing cache freshness checks
- **Fix Applied**: Changed to use `readMonth` (which uses `fetchQuery`) to respect cache freshness
- **Status**: ✅ **FIXED**

The fix ensures that when fetching the previous month for recalculation, we respect cache freshness and refetch if the cache is stale or missing.

### Note on Other readMonthDirect Usages
`readMonthDirect` is still used in other places, but these are intentional:
- `useMonthQuery.ts` → `fetchMonth`: Used by `useQuery` hook which handles caching separately (avoids deadlock)
- `useInitialBalanceCalculation.ts`: Initial balance calculation needs to read from Firestore to get initial state
- `useMonthPrefetch.ts`: Uses `prefetchQuery` which handles caching properly
