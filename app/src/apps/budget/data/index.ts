/**
 * Budget Data Layer Exports
 *
 * Central export point for all budget-specific data layer modules.
 *
 * For shared data (queryClient, QueryProvider, Firestore ops), use @data.
 */

// Budget-specific query keys
export { queryKeys } from './queryKeys'

// ============================================================================
// QUERY HOOKS (for React components)
// ============================================================================
export { useBudgetQuery, type BudgetData } from './queries/budget'
export { useMonthQuery, type MonthQueryData } from './queries/month'
export { usePayeesQuery, type UsePayeesQueryOptions } from './queries/payees'
export { useUserQuery } from './queries/user'
export { useAccessibleBudgetsQuery } from './queries/accessibleBudgets'
export { useFeedbackQuery, type FeedbackItem, type FlattenedFeedbackItem, type FeedbackData } from './queries/feedback'

// ============================================================================
// RECALCULATION
// ============================================================================
export {
  triggerRecalculation,
  ensureMonthsInMap,
  addMonthToMap,
} from './recalculation'

// ============================================================================
// CACHED READ FUNCTIONS (for non-React code that still needs caching)
// ============================================================================
export {
  fetchBudgetDocument,
  fetchBudgetInviteStatus,
  calculateCurrentBalances,
  calculateTotalBalances,
  calculateCategoryBalances,
  type CategoryBalanceResult,
} from './cachedReads'

// Month read functions
export { readMonth, readMonthForEdit, type ReadMonthOptions } from './queries/month'

// Month write functions
export { writeMonthData, type WriteMonthParams } from './mutations/month'

// Query helpers
export { getFutureMonths } from './queries/month'

// ============================================================================
// UTILITIES (re-exports from shared for convenience)
// ============================================================================
export { getMonthDocId } from '@utils'
export { arrayUnion } from '@firestore'

// ============================================================================
// CONSTANTS
// ============================================================================
export {
  NO_CATEGORY_ID,
  NO_CATEGORY_NAME,
  isNoCategory,
  NO_ACCOUNT_ID,
  NO_ACCOUNT_NAME,
  isNoAccount,
  SAMPLE_BUDGET_ID,
  SAMPLE_BUDGET_NAME,
  isSampleBudget,
} from './constants'
