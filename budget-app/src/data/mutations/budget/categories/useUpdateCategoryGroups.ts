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
import { writeBudgetData } from '../writeBudgetData'

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

  const mutation = useMutation<UpdateCategoryGroupsResult, Error, UpdateCategoryGroupsParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, categoryGroups } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKey, {
          ...previousData,
          categoryGroups,
        })
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      const { budgetId, categoryGroups } = params

      await writeBudgetData({
        budgetId,
        updates: { category_groups: categoryGroups },
        description: 'saving updated category groups (user edited group settings)',
      })

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
