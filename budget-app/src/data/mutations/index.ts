/**
 * Mutation Hooks Exports
 *
 * Mutations are organized by domain:
 * - infrastructure/ - Core mutation utilities (legacy factory kept for reference)
 * - budget/ - Budget document mutations (accounts, categories, rename)
 * - month/ - Month document mutations (income, expenses, allocations)
 * - user/ - User-related mutations (budget creation, invites)
 * - feedback/ - Feedback mutations
 * - payees/ - Payee mutations
 *
 * ARCHITECTURE: All mutations use React Query's native useMutation with optimistic updates.
 * The pattern is:
 * 1. onMutate: Cancel queries, save previous state, apply optimistic update
 * 2. mutationFn: Write to Firestore
 * 3. onError: Rollback to previous state
 */

// Month write operations
export {
  writeMonthData,
  type WriteMonthParams,
} from './month'

// Recalculation helpers - re-exported from canonical location
export {
  markMonthsNeedRecalculation,
  setMonthInBudgetMap,
} from '../recalculation'
