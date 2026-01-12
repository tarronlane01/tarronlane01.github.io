/**
 * Update Categories Mutation
 *
 * Updates all categories in the budget document.
 *
 * Uses React Query's native optimistic update pattern.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { CategoriesMap, FirestoreData } from '@types'
import { writeBudgetData } from '../writeBudgetData'

// ============================================================================
// HELPERS
// ============================================================================

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

// ============================================================================
// TYPES
// ============================================================================

interface UpdateCategoriesParams {
  budgetId: string
  categories: CategoriesMap
}

interface UpdateCategoriesResult {
  categories: CategoriesMap
}

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useUpdateCategories() {
  const queryClient = useQueryClient()

  const mutation = useMutation<UpdateCategoriesResult, Error, UpdateCategoriesParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, categories } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKey, {
          ...previousData,
          categories,
        })
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      const { budgetId, categories } = params
      const cleanedCategories = cleanCategoriesForFirestore(categories)

      await writeBudgetData({
        budgetId,
        updates: { categories: cleanedCategories },
        description: 'saving updated categories (user edited category settings)',
      })

      return { categories }
    },

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const updateCategories = {
    mutate: (params: UpdateCategoriesParams) => mutation.mutate(params),
    mutateAsync: (params: UpdateCategoriesParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { updateCategories }
}
