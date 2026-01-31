/**
 * Delete Category Mutation
 *
 * Removes a single category from the budget document using Firestore's deleteField().
 * Only the category key is removed; no other document fields are touched.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { useBudget } from '@contexts'
import { useBudgetMutationHelpers } from '../mutationHelpers'
import { deleteBudgetCategoryKey } from '../writeBudgetData'

// ============================================================================
// TYPES
// ============================================================================

interface DeleteCategoryParams {
  budgetId: string
  categoryId: string
}

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { updateBudgetCacheAndTrack } = useBudgetMutationHelpers()

  const mutation = useMutation<void, Error, DeleteCategoryParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, categoryId } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)
      const isCurrentDocument = currentViewingDocument.type === 'budget'

      if (previousData?.categories && categoryId in previousData.categories) {
        const { [categoryId]: _removed, ...rest } = previousData.categories
        void _removed
        const updatedBudget: BudgetData = {
          ...previousData,
          categories: rest,
          budget: {
            ...previousData.budget,
            categories: rest,
          },
        }
        queryClient.setQueryData<BudgetData>(queryKey, updatedBudget)
        if (!isCurrentDocument) {
          updateBudgetCacheAndTrack(budgetId, updatedBudget)
        }
      }

      if (isCurrentDocument) {
        try {
          await deleteBudgetCategoryKey(budgetId, categoryId, 'categories: delete (targeted key)')
        } catch (error) {
          console.warn('[useDeleteCategory] Failed to delete category key:', error)
        }
      }

      return { previousData }
    },

    mutationFn: async () => {
      // Firestore write is done in onMutate when isCurrentDocument
      return undefined
    },

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const deleteCategory = {
    mutate: (params: DeleteCategoryParams) => mutation.mutate(params),
    mutateAsync: (params: DeleteCategoryParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { deleteCategory }
}
