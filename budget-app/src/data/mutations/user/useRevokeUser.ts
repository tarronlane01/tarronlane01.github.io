/**
 * Revoke User Mutation
 *
 * Revokes a user's access to a budget by removing them from user_ids and accepted_user_ids.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 * PATTERN: Uses arrayRemove for atomic array removal (no read-then-write).
 */

import { createOptimisticMutation } from '../infrastructure'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { arrayRemove } from '@firestore'
import { writeBudgetData } from '../budget/writeBudgetData'

// ============================================================================
// TYPES
// ============================================================================

interface RevokeUserParams {
  budgetId: string
  userId: string
}

interface RevokeUserResult {
  budgetId: string
}

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useRevokeUserInternal = createOptimisticMutation<
  RevokeUserParams,
  RevokeUserResult,
  BudgetData
>({
  optimisticUpdate: (params) => {
    const { budgetId, userId } = params

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
            user_ids: cachedData.budget.user_ids.filter(id => id !== userId),
            accepted_user_ids: cachedData.budget.accepted_user_ids.filter(id => id !== userId),
          },
        }
      },
    }
  },

  mutationFn: async (params) => {
    const { budgetId, userId } = params

    // Use arrayRemove for atomic removal (no need to read current arrays)
    await writeBudgetData({
      budgetId,
      updates: {
        user_ids: arrayRemove(userId),
        accepted_user_ids: arrayRemove(userId),
      },
      description: "removing user from budget's access lists",
    })

    return { budgetId }
  },
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useRevokeUser() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useRevokeUserInternal()

  const revokeUser = {
    mutate: (params: RevokeUserParams) => mutate(params),
    mutateAsync: (params: RevokeUserParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { revokeUser }
}
