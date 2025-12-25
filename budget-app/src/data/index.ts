/**
 * Data Layer Exports
 *
 * Central export point for all data layer modules.
 *
 * ⚠️ ARCHITECTURE RULES:
 *
 * 1. ALL READS should go through React Query:
 *    - For React components: use query hooks (useBudgetQuery, useMonthQuery, etc.)
 *    - For non-React code: use cachedReads (fetchBudgetDocument, calculateCategoryBalances, etc.)
 *
 * 2. ALL WRITES should go through React Query mutations:
 *    - useBudgetMutations for budget-level changes
 *    - useMonthMutations for month-level changes (income, expenses, allocations)
 *    - useUserMutations for user document changes
 *    - useFeedbackMutations for feedback
 *
 * DO NOT import from './firestore/operations' directly - it bypasses caching.
 * The ESLint rule 'no-restricted-imports' will catch violations.
 */

// Query client and provider
export { queryClient, queryKeys, localStoragePersister } from './queryClient'
export { QueryProvider } from './QueryProvider'

// ============================================================================
// QUERY HOOKS (for React components)
// ============================================================================
export { useBudgetQuery, useBudgetDataQuery, type BudgetData } from './queries/useBudgetQuery'
export {
  useMonthQuery,
  type MonthQueryData,
  markNextMonthSnapshotStaleInCache,
  markNextMonthSnapshotStaleInFirestore,
} from './queries/useMonthQuery'
export { usePayeesQuery } from './queries/usePayeesQuery'
export { useUserQuery } from './queries/useUserQuery'
export { useAccessibleBudgetsQuery } from './queries/useAccessibleBudgetsQuery'
export { useFeedbackQuery, type FeedbackItem, type FlattenedFeedbackItem, type FeedbackData } from './queries/useFeedbackQuery'

// ============================================================================
// MUTATION HOOKS (for all writes)
// ============================================================================
export { useBudgetMutations } from './mutations/useBudgetMutations'
export {
  useMonthMutations,
  // Re-export helpers that are safe for external use
  // Cache-only helpers (for onMutate)
  markCategoryBalancesSnapshotStaleInCache,
  markMonthCategoryBalancesStaleInCache,
  markFutureMonthsCategoryBalancesStaleInCache,
  // Firestore-only helpers (for mutationFn)
  markCategoryBalancesSnapshotStaleInFirestore,
  markMonthCategoryBalancesStaleInFirestore,
  markFutureMonthsCategoryBalancesStaleInFirestore,
} from './mutations/useMonthMutations'
export { useUserMutations } from './mutations/useUserMutations'
export { useFeedbackMutations } from './mutations/useFeedbackMutations'

// ============================================================================
// CACHED READ FUNCTIONS (for non-React code that still needs caching)
// ============================================================================
export {
  fetchBudgetDocument,
  fetchBudgetInviteStatus,
  // Category balance calculation (optimized walk-back/walk-forward)
  calculateCurrentBalances,
  calculateTotalBalances,
  calculateCategoryBalances,
  type CategoryBalanceResult,
} from './cachedReads'

// ============================================================================
// UTILITIES (safe to use anywhere)
// ============================================================================
// These are pure functions that don't do I/O
export {
  getMonthDocId,
  stripUndefined,
  cleanAccountsForFirestore,
  cleanIncomeForFirestore,
  cleanAllocationsForFirestore,
  cleanExpensesForFirestore,
  cleanCategoryBalancesForFirestore,
} from './firestore/operations'

// Re-export arrayUnion for mutation params
export { arrayUnion } from './firestore/operations'
