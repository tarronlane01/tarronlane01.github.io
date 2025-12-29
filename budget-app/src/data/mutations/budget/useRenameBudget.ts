/**
 * Rename Budget Mutation Hook
 *
 * Provides mutation function to rename a budget.
 * Uses optimistic updates and updates the cache with server response.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { FirestoreData } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'

interface RenameBudgetParams {
  budgetId: string
  newName: string
}

/**
 * Hook providing mutation function to rename a budget
 */
export function useRenameBudget() {
  const queryClient = useQueryClient()

  const renameBudget = useMutation({
    mutationFn: async ({ budgetId, newName }: RenameBudgetParams) => {
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
          name: newName.trim(),
        },
        `renaming budget to "${newName.trim()}"`
      )

      return newName.trim()
    },
    onMutate: async ({ budgetId, newName }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          budget: {
            ...previousData.budget,
            name: newName.trim(),
          },
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          budget: {
            ...currentData.budget,
            name: data,
          },
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  return {
    renameBudget,
  }
}

