/**
 * Mark Budget Needs Recalculation
 *
 * Marks the budget document as needing recalculation.
 * Uses cache-aware logic to avoid redundant Firestore writes.
 *
 * This flag indicates that derived budget-level data (like account balance
 * aggregations) may be out of date due to changes in month data.
 *
 * WHEN TO CALL:
 * - After any month data changes that affect account balances
 * - Called automatically by writeMonthData
 *
 * WHAT HAPPENS ON READ:
 * - When budget is loaded with is_needs_recalculation = true
 * - resolveBudgetIfStale walks through months to recalculate balances
 * - See: resolveBudgetIfStale.ts
 */

import { updateDocByPath } from '@firestore'
import { queryClient, queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/budget'

// ============================================================================
// CACHE HELPERS
// ============================================================================

/**
 * Check if the budget is already marked as needing recalculation in cache.
 * Returns true if the budget is in cache (fresh) AND already marked.
 */
function isAlreadyMarkedInCache(budgetId: string): boolean {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)

  // If not in cache, we can't skip - need to send the write
  if (!cachedBudget) return false

  // Check the isNeedsRecalculation flag
  return cachedBudget.isNeedsRecalculation === true
}

/**
 * Update the cache to mark the budget as needing recalculation.
 * Called before sending the Firestore write to prevent duplicate writes.
 */
function markInCache(budgetId: string): void {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)

  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...cachedBudget,
      isNeedsRecalculation: true,
    })
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Mark the budget document as needing recalculation.
 *
 * Optimizations:
 * - Checks cache before writing - skips if already marked
 * - Updates cache immediately to prevent duplicate writes from concurrent calls
 * - Uses updateDocByPath with minimal payload
 *
 * @param budgetId - The budget ID to mark
 * @returns true if marked, false if skipped (already marked)
 */
export async function markBudgetNeedsRecalculation(budgetId: string): Promise<boolean> {
  // Check cache - skip if already marked
  if (isAlreadyMarkedInCache(budgetId)) {
    return false
  }

  // Update cache immediately to prevent duplicate writes
  markInCache(budgetId)

  // Send Firestore update
  await updateDocByPath(
    'budgets',
    budgetId,
    {
      is_needs_recalculation: true,
      updated_at: new Date().toISOString(),
    },
    'marking budget as is_needs_recalculation (month data changed)'
  )

  return true
}

