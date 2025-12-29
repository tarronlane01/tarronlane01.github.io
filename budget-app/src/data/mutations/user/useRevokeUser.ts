/**
 * Revoke User Mutation
 *
 * Revokes a user's access to a budget by removing them from user_ids and accepted_user_ids.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { readDocByPath, writeDocByPath } from '@firestore'
import type { FirestoreData } from '@types'

interface RevokeUserParams {
  budgetId: string
  userId: string
}

export function useRevokeUser() {
  const queryClient = useQueryClient()

  const revokeUser = useMutation({
    mutationFn: async ({ budgetId, userId }: RevokeUserParams) => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      await writeDocByPath(
        'budgets',
        budgetId,
        {
          ...data,
          user_ids: (data.user_ids || []).filter((id: string) => id !== userId),
          accepted_user_ids: (data.accepted_user_ids || []).filter((id: string) => id !== userId),
        },
        'removing user from budget\'s access lists'
      )

      return { budgetId }
    },
    onMutate: async ({ budgetId, userId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
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
    onSuccess: (_, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), currentData)
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  return { revokeUser }
}

