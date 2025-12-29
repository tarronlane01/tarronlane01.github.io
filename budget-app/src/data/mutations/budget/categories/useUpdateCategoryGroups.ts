/**
 * Update Category Groups Mutation
 *
 * Updates category groups in the budget document.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { CategoryGroup, FirestoreData } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'

interface UpdateCategoryGroupsParams {
  budgetId: string
  categoryGroups: CategoryGroup[]
}

export function useUpdateCategoryGroups() {
  const queryClient = useQueryClient()

  const updateCategoryGroups = useMutation({
    mutationFn: async ({ budgetId, categoryGroups }: UpdateCategoryGroupsParams) => {
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
          category_groups: categoryGroups,
        },
        'saving updated category groups (user edited group settings)'
      )

      return categoryGroups
    },
    onMutate: async ({ budgetId, categoryGroups }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          categoryGroups,
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          categoryGroups: data,
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  return { updateCategoryGroups }
}

