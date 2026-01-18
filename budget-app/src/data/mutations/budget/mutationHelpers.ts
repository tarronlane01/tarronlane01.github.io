/**
 * Budget Mutation Helpers
 *
 * Shared helpers for budget mutations to:
 * - Track changes in sync context automatically
 * - Update cache immediately
 */

import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { useSync } from '@contexts/sync_context'

/**
 * Track a budget change from a non-hook context (e.g., createMonth).
 * This accesses the sync context directly from the queryClient's context.
 *
 * NOTE: This is a workaround for calling trackChange from non-hook contexts.
 * In the future, we might want to refactor to pass trackChange as a parameter.
 */
// Removed unused trackBudgetChange function - not implemented

/**
 * Hook that provides automatic change tracking for budget mutations.
 * Use this in mutation hooks to get helpers that automatically track changes.
 *
 * This hook automatically handles:
 * - Cache updates with change tracking
 *
 * Example:
 * ```ts
 * const { updateBudgetCacheAndTrack } = useBudgetMutationHelpers()
 *
 * // Update cache and track change automatically
 * updateBudgetCacheAndTrack(budgetId, updatedBudgetData)
 * ```
 */
export function useBudgetMutationHelpers() {
  const { trackChange } = useSync()

  /**
   * Update budget cache and automatically track the change.
   * This replaces the pattern of:
   * - queryClient.setQueryData(...)
   * - trackChange({ type: 'budget', ... })
   */
  const updateBudgetCacheAndTrack = (
    budgetId: string,
    budgetData: BudgetData
  ): void => {
    // Update cache
    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), budgetData)

    // Automatically track change
    trackChange({
      type: 'budget',
      budgetId,
    })
  }

  return {
    updateBudgetCacheAndTrack,
  }
}

