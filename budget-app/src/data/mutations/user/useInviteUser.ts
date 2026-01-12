/**
 * Invite User Mutation
 *
 * Invites a user to a budget by adding them to the user_ids list.
 *
 * Uses React Query's native optimistic update pattern.
 * PATTERN: Uses arrayUnion for atomic array addition (no read-then-write).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
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

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useInviteUser() {
  const queryClient = useQueryClient()

  const mutation = useMutation<InviteUserResult, Error, InviteUserParams, MutationContext>({
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
            user_ids: [...previousData.budget.user_ids, userId],
          },
        })
      }

      return { previousData }
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

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const inviteUser = {
    mutate: (params: InviteUserParams) => mutation.mutate(params),
    mutateAsync: (params: InviteUserParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { inviteUser }
}
