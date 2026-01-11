/**
 * Update Categories Mutation
 *
 * Updates all categories in the budget document.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 */

import { createOptimisticMutation } from '../../infrastructure'
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

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useUpdateCategoriesInternal = createOptimisticMutation<
  UpdateCategoriesParams,
  UpdateCategoriesResult,
  BudgetData
>({
  optimisticUpdate: (params) => {
    const { budgetId, categories } = params

    return {
      cacheKey: queryKeys.budget(budgetId),
      transform: (cachedData) => {
        if (!cachedData) {
          return cachedData as unknown as BudgetData
        }

        return {
          ...cachedData,
          categories,
        }
      },
    }
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
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useUpdateCategories() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useUpdateCategoriesInternal()

  const updateCategories = {
    mutate: (params: UpdateCategoriesParams) => mutate(params),
    mutateAsync: (params: UpdateCategoriesParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { updateCategories }
}
