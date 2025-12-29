/**
 * Invite User Mutation
 *
 * Invites a user to a budget by adding them to the user_ids list.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { readDocByPath, writeDocByPath } from '@firestore'
import type { FirestoreData } from '@types'

interface InviteUserParams {
  budgetId: string
  userId: string
}

export function useInviteUser() {
  const queryClient = useQueryClient()

  const inviteUser = useMutation({
    mutationFn: async ({ budgetId, userId }: InviteUserParams) => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      if (data.user_ids?.includes(userId)) {
        throw new Error('User is already invited')
      }

      await writeDocByPath(
        'budgets',
        budgetId,
        {
          ...data,
          user_ids: [...(data.user_ids || []), userId],
        },
        'adding user to budget\'s invited users list'
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
            user_ids: [...previousData.budget.user_ids, userId],
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

  return { inviteUser }
}

