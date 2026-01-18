/**
 * Update Category Groups Mutation
 *
 * Updates category groups in the budget document.
 *
 * Uses React Query's native optimistic update pattern.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { CategoryGroup } from '@types'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useBudgetMutationHelpers } from '../mutationHelpers'

// ============================================================================
// TYPES
// ============================================================================

interface UpdateCategoryGroupsParams {
  budgetId: string
  categoryGroups: CategoryGroup[]
}

interface UpdateCategoryGroupsResult {
  categoryGroups: CategoryGroup[]
}

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useUpdateCategoryGroups() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateBudgetCacheAndTrack } = useBudgetMutationHelpers()

  const mutation = useMutation<UpdateCategoryGroupsResult, Error, UpdateCategoryGroupsParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, categoryGroups } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache and track change automatically
      if (previousData) {
        const updatedBudget: BudgetData = {
          ...previousData,
          categoryGroups,
        }
        updateBudgetCacheAndTrack(budgetId, updatedBudget)
      }

      // Save current document immediately if viewing budget settings
      const isCurrentDocument = currentViewingDocument.type === 'budget'

      if (isCurrentDocument) {
        try {
          await saveCurrentDocument(budgetId, 'budget')
        } catch (error) {
          console.warn('[useUpdateCategoryGroups] Failed to save current document immediately:', error)
          // Continue even if immediate save fails - background save will handle it
        }
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      // NO Firestore write! Just return the cached data
      const { categoryGroups } = params
      return { categoryGroups }
    },

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const updateCategoryGroups = {
    mutate: (params: UpdateCategoryGroupsParams) => mutation.mutate(params),
    mutateAsync: (params: UpdateCategoryGroupsParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { updateCategoryGroups }
}
