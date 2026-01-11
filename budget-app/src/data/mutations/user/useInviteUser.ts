/**
 * Invite User Mutation
 *
 * Invites a user to a budget by adding them to the user_ids list.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 * PATTERN: Uses arrayUnion for atomic array addition (no read-then-write).
 */

import { createOptimisticMutation } from '../infrastructure'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { arrayUnion, readDocByPath } from '@firestore'
import type { FirestoreData } from '@types'
import { writeBudgetData } from '../budget/writeBudgetData'

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

    // Validation read: check if user is already invited
    const { exists, data } = await readDocByPath<FirestoreData>(
      'budgets',
      budgetId,
      'validating user is not already invited'
    )

    if (!exists || !data) {
      throw new Error('Budget not found')
    }

    if (data.user_ids?.includes(userId)) {
      throw new Error('User is already invited')
    }

    // Use arrayUnion for atomic addition (no need to read current array)
    await writeBudgetData({
      budgetId,
      updates: { user_ids: arrayUnion(userId) },
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
