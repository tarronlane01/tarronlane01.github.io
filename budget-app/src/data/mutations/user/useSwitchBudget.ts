/**
 * Switch Budget Mutation
 *
 * Switches the active budget by moving it to the front of the user's budget_ids list.
 *
 * Uses React Query's native optimistic update pattern.
 *
 * NOTE: This operation requires a read because we need to reorder the array
 * (move selected budget to front). This cannot be done with arrayUnion/arrayRemove.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
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

interface MutationContext {
  previousData: UserDocument | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useSwitchBudget() {
  const queryClient = useQueryClient()

  const mutation = useMutation<SwitchBudgetResult, Error, SwitchBudgetParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, userId } = params
      const queryKey = queryKeys.user(userId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<UserDocument>(queryKey)

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<UserDocument>(queryKey, {
          ...previousData,
          budget_ids: [budgetId, ...previousData.budget_ids.filter(id => id !== budgetId)],
        })
      }

      return { previousData }
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

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.user(params.userId), context.previousData)
      }
    },
  })

  const switchBudget = {
    mutate: (params: SwitchBudgetParams) => mutation.mutate(params),
    mutateAsync: (params: SwitchBudgetParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { switchBudget }
}
