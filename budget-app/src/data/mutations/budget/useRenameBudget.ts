/**
 * Rename Budget Mutation Hook
 *
 * Provides mutation function to rename a budget.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation:
 * 1. Factory REQUIRES optimisticUpdate function - won't compile without it
 * 2. Updates cache instantly (UI reflects change immediately)
 * 3. In background: reads fresh data from Firestore, merges, writes
 * 4. On error: automatic rollback to previous cache state
 */

import { createOptimisticMutation } from '../infrastructure'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { writeBudgetData } from './writeBudgetData'

// ============================================================================
// TYPES
// ============================================================================

interface RenameBudgetParams {
  budgetId: string
  newName: string
}

interface RenameBudgetResult {
  newName: string
}

// ============================================================================
// INTERNAL HOOK - Created via factory with REQUIRED optimistic update
// ============================================================================

const useRenameBudgetInternal = createOptimisticMutation<
  RenameBudgetParams,
  RenameBudgetResult,
  BudgetData
>({
  // =========================================================================
  // REQUIRED: Optimistic update function
  // This is the enforcement mechanism - factory won't work without it
  // =========================================================================
  optimisticUpdate: (params) => {
    const { budgetId, newName } = params

    return {
      cacheKey: queryKeys.budget(budgetId),
      transform: (cachedData) => {
        if (!cachedData) {
          return cachedData as unknown as BudgetData
        }

        return {
          ...cachedData,
          budget: {
            ...cachedData.budget,
            name: newName.trim(),
          },
        }
      },
    }
  },

  // =========================================================================
  // REQUIRED: Actual mutation function
  // =========================================================================
  mutationFn: async (params) => {
    const { budgetId, newName } = params
    const trimmedName = newName.trim()

    await writeBudgetData({
      budgetId,
      updates: { name: trimmedName },
      description: `renaming budget to "${trimmedName}"`,
    })

    return { newName: trimmedName }
  },
})

// ============================================================================
// PUBLIC HOOK - Maintains backwards-compatible API
// ============================================================================

/**
 * Hook providing mutation function to rename a budget.
 *
 * Returns an object with renameBudget mutation that can be called with
 * mutate() or mutateAsync().
 */
export function useRenameBudget() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useRenameBudgetInternal()

  // Wrap in an object to maintain the same API as before
  const renameBudget = {
    mutate: (params: RenameBudgetParams) => mutate(params),
    mutateAsync: (params: RenameBudgetParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return {
    renameBudget,
  }
}
