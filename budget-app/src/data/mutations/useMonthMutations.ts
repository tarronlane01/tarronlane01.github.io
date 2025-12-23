/**
 * Month Mutations Hook
 *
 * Combines all month-level mutation hooks for a unified API:
 * - Income transactions (add, update, delete)
 * - Expense transactions (add, update, delete)
 * - Allocations (save, finalize, unfinalize)
 *
 * All mutations use optimistic updates and update the cache with server response.
 * NO invalidateQueries calls - we trust the mutation result to avoid unnecessary reads.
 *
 * CROSS-MONTH PATTERN:
 * When editing data that affects the next month's snapshot (income totals, ending balances),
 * the next month is marked as stale. The stale flag is:
 * 1. Set immediately in cache (for instant UI awareness)
 * 2. Written to Firestore ONLY if not already stale (to avoid duplicate writes)
 */

import { useIncomeMutations } from './useIncomeMutations'
import { useExpenseMutations } from './useExpenseMutations'
import { useAllocationMutations } from './useAllocationMutations'

// Re-export types for convenience
export type {
  AddIncomeParams,
  UpdateIncomeParams,
  DeleteIncomeParams,
  AddExpenseParams,
  UpdateExpenseParams,
  DeleteExpenseParams,
  SaveAllocationsParams,
  FinalizeAllocationsParams,
  UnfinalizeAllocationsParams,
} from './monthMutationTypes'

// Re-export helper functions for use elsewhere if needed
export {
  saveMonthToFirestore,
  updateAccountBalance,
  savePayeeIfNew,
} from './monthMutationHelpers'

// Re-export individual hooks for granular usage
export { useIncomeMutations } from './useIncomeMutations'
export { useExpenseMutations } from './useExpenseMutations'
export { useAllocationMutations } from './useAllocationMutations'

/**
 * Combined hook providing all month mutation functions
 *
 * Pattern for all mutations:
 * - onMutate: Optimistic update (instant UI feedback)
 * - mutationFn: Firestore write (returns server truth)
 * - onSuccess: Update cache with server response (NO refetch)
 * - onError: Rollback to previous state
 *
 * This pattern ensures:
 * - Zero unnecessary Firestore reads after mutations
 * - Instant UI updates via optimistic updates
 * - Cache stays in sync with Firestore
 */
export function useMonthMutations() {
  const { addIncome, updateIncome, deleteIncome } = useIncomeMutations()
  const { addExpense, updateExpense, deleteExpense } = useExpenseMutations()
  const { saveAllocations, finalizeAllocations, unfinalizeAllocations } = useAllocationMutations()

  return {
    // Income
    addIncome,
    updateIncome,
    deleteIncome,
    // Expenses
    addExpense,
    updateExpense,
    deleteExpense,
    // Allocations
    saveAllocations,
    finalizeAllocations,
    unfinalizeAllocations,
  }
}
