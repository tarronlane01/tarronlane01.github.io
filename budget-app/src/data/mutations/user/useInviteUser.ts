/**
 * Invite User Mutation
 *
 * Invites a user to a budget by adding them to the user_ids list.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 */

import { createOptimisticMutation } from '../infrastructure'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { writeBudgetData, readBudgetForEdit } from '../budget/writeBudgetData'

// ============================================================================
// TYPES
// ============================================================================

interface InviteUserParams {
  budgetId: string
  userId: string
}

interface InviteUserResult {
  budgetId: string
}

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useInviteUserInternal = createOptimisticMutation<
  InviteUserParams,
  InviteUserResult,
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
            user_ids: [...cachedData.budget.user_ids, userId],
          },
        }
      },
    }
  },

  mutationFn: async (params) => {
    const { budgetId, userId } = params

    const freshData = await readBudgetForEdit(budgetId, 'invite user')

    if (freshData.user_ids?.includes(userId)) {
      throw new Error('User is already invited')
    }

    await writeBudgetData({
      budgetId,
      updates: { user_ids: [...(freshData.user_ids || []), userId] },
      description: "adding user to budget's invited users list",
    })

    return { budgetId }
  },
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useInviteUser() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useInviteUserInternal()

  const inviteUser = {
    mutate: (params: InviteUserParams) => mutate(params),
    mutateAsync: (params: InviteUserParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { inviteUser }
}
