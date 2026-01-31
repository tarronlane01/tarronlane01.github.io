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
import type { CategoriesMap } from '@types'
import { useBudget } from '@contexts'
import { useBudgetMutationHelpers } from '../mutationHelpers'
import { writeBudgetData } from '../writeBudgetData'

// ============================================================================
// HELPERS
// ============================================================================

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
  const { currentViewingDocument } = useBudget()
  const { updateBudgetCacheAndTrack } = useBudgetMutationHelpers()

  const mutation = useMutation<UpdateCategoriesResult, Error, UpdateCategoriesParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, categories } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)
      const isCurrentDocument = currentViewingDocument.type === 'budget'

      if (previousData) {
        const updatedBudget: BudgetData = {
          ...previousData,
          categories,
          budget: {
            ...previousData.budget,
            categories,
          },
        }
        // Update cache so UI shows correct data
        queryClient.setQueryData<BudgetData>(queryKey, updatedBudget)
        // Only track change when we're NOT writing here — if we write below, tracking would
        // cause navigation save to read cache and write again, which can overwrite our write
        // with stale data if a refetch overwrote the cache in between.
        if (!isCurrentDocument) {
          updateBudgetCacheAndTrack(budgetId, updatedBudget)
        }
      }

      // Persist categories immediately when viewing budget settings.
      // Write the mutation payload directly (not from cache) so we never persist
      // stale data if a refetch overwrote the cache before save ran.
      if (isCurrentDocument) {
        try {
          await writeBudgetData({
            budgetId,
            updates: { categories },
            description: 'categories: update (settings)',
          })
        } catch (error) {
          console.warn('[useUpdateCategories] Failed to save categories immediately:', error)
          // Continue even if immediate save fails - background save will handle it
        }
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      // NO Firestore write! Just return the cached data
      const { categories } = params
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
