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
 *    - Budget mutations: import from './mutations/budget'
 *    - Month mutations: import from './mutations/month'
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
export { useBudgetQuery, type BudgetData } from './queries/budget'
export { useMonthQuery, type MonthQueryData } from './queries/month'
export { usePayeesQuery } from './queries/payees'
export { useUserQuery } from './queries/user'
export { useAccessibleBudgetsQuery } from './queries/accessibleBudgets'
export { useFeedbackQuery, type FeedbackItem, type FlattenedFeedbackItem, type FeedbackData } from './queries/feedback'

// ============================================================================
// MUTATION HOOKS (for all writes)
// ============================================================================
// Import directly from mutation folders:
// - Budget: import from './mutations/budget'
// - Month: import from './mutations/month'
// - User: import from './mutations/user'
// - Feedback: import from './mutations/feedback'

// ============================================================================
// RECALCULATION
// ============================================================================
export {
  // Main entry point - called when is_needs_recalculation is detected
  triggerRecalculation,
  // Marking as stale (when data changes) - used by writeMonthData
  markMonthsNeedRecalculation,
  setMonthInBudgetMap,
} from './recalculation'

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

// Month read functions
export { readMonth, readMonthForEdit, type ReadMonthOptions } from './queries/month'

// Month write functions
export { writeMonthData, type WriteMonthParams } from './mutations/month'

// ============================================================================
// UTILITIES (safe to use anywhere)
// ============================================================================
// These are pure functions that don't do I/O
export { getMonthDocId } from '@utils'
export { arrayUnion } from '@firestore'

// Query helpers
export { getFutureMonths } from './queries/month'
