/**
 * Budget Mutation Helpers
 *
 * Shared helpers for budget mutations: update cache immediately.
 * Data is written on edit; there is no change tracking.
 */

import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'

/**
 * Update budget cache. Mutations write to Firestore immediately; no queue.
 */
export function useBudgetMutationHelpers() {
  const updateBudgetCacheAndTrack = (
    budgetId: string,
    budgetData: BudgetData
  ): void => {
    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), budgetData)
  }

  return {
    updateBudgetCacheAndTrack,
  }
}
