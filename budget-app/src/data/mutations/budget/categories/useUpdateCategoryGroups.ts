/**
 * Update Category Groups Mutation
 *
 * Updates category groups in the budget document.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 */

import { createOptimisticMutation } from '../../infrastructure'
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

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useUpdateCategoryGroupsInternal = createOptimisticMutation<
  UpdateCategoryGroupsParams,
  UpdateCategoryGroupsResult,
  BudgetData
>({
  optimisticUpdate: (params) => {
    const { budgetId, categoryGroups } = params

    return {
      cacheKey: queryKeys.budget(budgetId),
      transform: (cachedData) => {
        if (!cachedData) {
          return cachedData as unknown as BudgetData
        }

        return {
          ...cachedData,
          categoryGroups,
        }
      },
    }
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
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useUpdateCategoryGroups() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useUpdateCategoryGroupsInternal()

  const updateCategoryGroups = {
    mutate: (params: UpdateCategoryGroupsParams) => mutate(params),
    mutateAsync: (params: UpdateCategoryGroupsParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { updateCategoryGroups }
}
