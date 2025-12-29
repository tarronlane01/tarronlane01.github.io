/**
 * Switch Budget Mutation
 *
 * Switches the active budget by moving it to the front of the user's budget_ids list.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import { readDocByPath, writeDocByPath } from '@firestore'
import type { UserDocument } from '@types'

interface SwitchBudgetParams {
  budgetId: string
  userId: string
}

export function useSwitchBudget() {
  const queryClient = useQueryClient()

  const switchBudget = useMutation({
    mutationFn: async ({ budgetId, userId }: SwitchBudgetParams) => {
      const { exists, data: userData } = await readDocByPath<UserDocument>(
        'users',
        userId,
        'PRE-EDIT-READ'
      )

      if (!exists || !userData) {
        throw new Error('User document not found')
      }

      const updatedBudgetIds = [budgetId, ...userData.budget_ids.filter(id => id !== budgetId)]

      await writeDocByPath(
        'users',
        userId,
        {
          ...userData,
          budget_ids: updatedBudgetIds,
          updated_at: new Date().toISOString(),
        },
        'reordering budget list to make selected budget active'
      )

      return { budgetId }
    },
    onMutate: async ({ budgetId, userId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.user(userId) })
      const previousData = queryClient.getQueryData<UserDocument>(queryKeys.user(userId))

      if (previousData) {
        queryClient.setQueryData<UserDocument>(queryKeys.user(userId), {
          ...previousData,
          budget_ids: [budgetId, ...previousData.budget_ids.filter(id => id !== budgetId)],
        })
      }

      return { previousData }
    },
    onSuccess: (_, { userId }) => {
      const currentData = queryClient.getQueryData<UserDocument>(queryKeys.user(userId))
      if (currentData) {
        queryClient.setQueryData(queryKeys.user(userId), currentData)
      }
    },
    onError: (_err, { userId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.user(userId), context.previousData)
      }
    },
  })

  return { switchBudget }
}

