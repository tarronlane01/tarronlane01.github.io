/**
 * Update Budget Category Balance (utility function)
 *
 * Updates category balances in the React Query CACHE ONLY for immediate UI feedback.
 * Does NOT write to Firestore - the actual budget document is updated during recalculation.
 *
 * This avoids excessive Firestore reads/writes when finalizing allocations.
 * The budget is already marked for recalculation by the month write operation.
 *
 * This is a non-hook utility for use inside mutation functions.
 */

import { queryKeys, queryClient } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { CategoriesMap } from '@types'

interface CategoryBalanceDelta {
  categoryId: string
  delta: number
}

/**
 * Update one or more category balances in the React Query cache.
 * Also updates the cached total_available for immediate UI updates.
 *
 * NOTE: This does NOT write to Firestore. The budget document is updated
 * during recalculation, which is triggered automatically after month changes.
 *
 * @param budgetId - The budget ID
 * @param deltas - Array of category balance deltas to apply
 */
export async function updateBudgetCategoryBalances(
  budgetId: string,
  deltas: CategoryBalanceDelta[]
): Promise<void> {
  if (deltas.length === 0) return

  // Filter out zero deltas
  const nonZeroDeltas = deltas.filter(d => d.delta !== 0)
  if (nonZeroDeltas.length === 0) return

  // Update React Query cache only (no Firestore read/write)
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (!cachedBudget) {
    // If no cached budget, nothing to update - recalculation will handle it
    return
  }

  // Update category balances in cache and track changes to positive balances
  // Only positive balances count toward total_available (debt doesn't reduce it)
  let oldPositiveSum = 0
  let newPositiveSum = 0

  const updatedCategories: CategoriesMap = { ...cachedBudget.categories }
  for (const { categoryId, delta } of nonZeroDeltas) {
    if (updatedCategories[categoryId]) {
      const oldBalance = updatedCategories[categoryId].balance
      const newBalance = oldBalance + delta

      // Track only positive portions for total_available calculation
      if (oldBalance > 0) oldPositiveSum += oldBalance
      if (newBalance > 0) newPositiveSum += newBalance

      updatedCategories[categoryId] = {
        ...updatedCategories[categoryId],
        balance: newBalance,
      }
    }
  }

  // total_available = on_budget_accounts - positive_category_balances
  // Negative balances (debt) don't reduce total_available
  const positiveBalanceDelta = newPositiveSum - oldPositiveSum
  const updatedBudget = cachedBudget.budget ? {
    ...cachedBudget.budget,
    total_available: cachedBudget.budget.total_available - positiveBalanceDelta,
  } : cachedBudget.budget

  queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
    ...cachedBudget,
    categories: updatedCategories,
    budget: updatedBudget,
  })
}

