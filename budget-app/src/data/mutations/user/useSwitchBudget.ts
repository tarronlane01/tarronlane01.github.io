/**
 * Switch Budget Mutation
 *
 * Switches the active budget by moving it to the front of the user's budget_ids list.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 *
 * NOTE: This operation requires a read because we need to reorder the array
 * (move selected budget to front). This cannot be done with arrayUnion/arrayRemove.
 */

import { createOptimisticMutation } from '../infrastructure'
import { queryKeys } from '@data/queryClient'
import type { UserDocument } from '@types'
import { writeUserData, readUserForEdit } from './writeUserData'

// ============================================================================
// TYPES
// ============================================================================

interface SwitchBudgetParams {
  budgetId: string
  userId: string
}

interface SwitchBudgetResult {
  budgetId: string
}

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useSwitchBudgetInternal = createOptimisticMutation<
  SwitchBudgetParams,
  SwitchBudgetResult,
  UserDocument
>({
  optimisticUpdate: (params) => {
    const { budgetId, userId } = params

    return {
      cacheKey: queryKeys.user(userId),
      transform: (cachedData) => {
        if (!cachedData) {
          return cachedData as unknown as UserDocument
        }

        return {
          ...cachedData,
          budget_ids: [budgetId, ...cachedData.budget_ids.filter(id => id !== budgetId)],
        }
      },
    }
  },

  mutationFn: async (params) => {
    const { budgetId, userId } = params

    // Read required: need current array to reorder (move to front)
    // Cannot use arrayUnion/arrayRemove for reordering
    const userData = await readUserForEdit(userId, 'switch budget (reorder)')

    const updatedBudgetIds = [budgetId, ...userData.budget_ids.filter(id => id !== budgetId)]

    await writeUserData({
      userId,
      updates: { budget_ids: updatedBudgetIds },
      description: 'reordering budget list to make selected budget active',
    })

    return { budgetId }
  },
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useSwitchBudget() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useSwitchBudgetInternal()

  const switchBudget = {
    mutate: (params: SwitchBudgetParams) => mutate(params),
    mutateAsync: (params: SwitchBudgetParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { switchBudget }
}
