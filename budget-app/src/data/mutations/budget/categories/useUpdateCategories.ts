/**
 * Update Categories Mutation
 *
 * Updates all categories in the budget document.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { CategoriesMap, FirestoreData } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'

/**
 * Clean categories for Firestore (removes undefined values)
 */
function cleanCategoriesForFirestore(categories: CategoriesMap): FirestoreData {
  const cleaned: FirestoreData = {}
  Object.entries(categories).forEach(([catId, cat]) => {
    cleaned[catId] = {
      name: cat.name,
      category_group_id: cat.category_group_id ?? null,
      sort_order: cat.sort_order,
      balance: cat.balance ?? 0,
    }
    if (cat.description !== undefined) cleaned[catId].description = cat.description
    if (cat.default_monthly_amount !== undefined) cleaned[catId].default_monthly_amount = cat.default_monthly_amount
    if (cat.default_monthly_type !== undefined) cleaned[catId].default_monthly_type = cat.default_monthly_type
    if (cat.is_hidden !== undefined) cleaned[catId].is_hidden = cat.is_hidden
  })
  return cleaned
}

interface UpdateCategoriesParams {
  budgetId: string
  categories: CategoriesMap
}

export function useUpdateCategories() {
  const queryClient = useQueryClient()

  const updateCategories = useMutation({
    mutationFn: async ({ budgetId, categories }: UpdateCategoriesParams) => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      const cleanedCategories = cleanCategoriesForFirestore(categories)

      await writeDocByPath(
        'budgets',
        budgetId,
        {
          ...data,
          categories: cleanedCategories,
        },
        'saving updated categories (user edited category settings)'
      )

      return categories
    },
    onMutate: async ({ budgetId, categories }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          categories,
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          categories: data,
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  return { updateCategories }
}

