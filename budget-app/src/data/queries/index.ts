/**
 * Query Exports
 *
 * Organized by collection with one file per operation:
 * - budget/ - Budget document queries
 * - month/ - Month document queries
 * - user/ - User document queries
 * - payees/ - Payees document queries
 * - feedback/ - Feedback collection queries
 * - accessibleBudgets/ - Budgets the user has access to
 */

// ============================================================================
// BUDGET QUERIES
// ============================================================================

export {
  fetchBudget,
  useBudgetQuery,
  type BudgetData,
} from './budget'

// ============================================================================
// MONTH QUERIES
// ============================================================================

export {
  // Core read functions
  readMonth,
  readMonthForEdit,
  getFutureMonths,
  getEndBalancesFromMonth,
  // React Query hook
  useMonthQuery,
  // Types
  type MonthQueryData,
  type ReadMonthOptions,
  type MonthWithId,
} from './month'

// ============================================================================
// USER QUERIES
// ============================================================================

export {
  fetchUser,
  useUserQuery,
} from './user'

// ============================================================================
// PAYEES QUERIES
// ============================================================================

export {
  fetchPayees,
  usePayeesQuery,
} from './payees'

// ============================================================================
// FEEDBACK QUERIES
// ============================================================================

export {
  fetchFeedback,
  useFeedbackQuery,
  type FeedbackItem,
  type FlattenedFeedbackItem,
  type FeedbackData,
} from './feedback'

// ============================================================================
// ACCESSIBLE BUDGETS QUERIES
// ============================================================================

export {
  fetchAccessibleBudgets,
  useAccessibleBudgetsQuery,
  type AccessibleBudgetsData,
} from './accessibleBudgets'

// ============================================================================
// RE-EXPORTS FROM RELATED MODULES
// ============================================================================

// Month write - in mutations/month/
export {
  writeMonthData,
  type WriteMonthParams,
} from '../mutations/month'

// Recalculation - in recalculation/
export {
  triggerRecalculation,
  markMonthsNeedRecalculation,
  setMonthInBudgetMap,
} from '../recalculation'

// Date utilities
export { getPreviousMonth, getNextMonth } from '@utils'
