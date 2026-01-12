/**
 * Revoke User Mutation
 *
 * Revokes a user's access to a budget by removing them from user_ids and accepted_user_ids.
 *
 * Uses React Query's native optimistic update pattern.
 * PATTERN: Uses arrayRemove for atomic array removal (no read-then-write).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
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

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useRevokeUser() {
  const queryClient = useQueryClient()

  const mutation = useMutation<RevokeUserResult, Error, RevokeUserParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, userId } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKey, {
          ...previousData,
          budget: {
            ...previousData.budget,
            user_ids: previousData.budget.user_ids.filter(id => id !== userId),
            accepted_user_ids: previousData.budget.accepted_user_ids.filter(id => id !== userId),
          },
        })
      }

      return { previousData }
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

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const revokeUser = {
    mutate: (params: RevokeUserParams) => mutation.mutate(params),
    mutateAsync: (params: RevokeUserParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { revokeUser }
}
