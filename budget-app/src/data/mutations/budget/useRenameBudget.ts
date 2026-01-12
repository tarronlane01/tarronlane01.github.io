/**
 * Rename Budget Mutation Hook
 *
 * Provides mutation function to rename a budget.
 *
 * Uses React Query's native optimistic update pattern:
 * 1. onMutate: Cancel queries, save previous state, apply optimistic update
 * 2. mutationFn: Write to Firestore
 * 3. onError: Rollback to previous state
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { writeBudgetData } from './writeBudgetData'

// ============================================================================
// TYPES
// ============================================================================

interface RenameBudgetParams {
  budgetId: string
  newName: string
}

interface RenameBudgetResult {
  newName: string
}

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useRenameBudget() {
  const queryClient = useQueryClient()

  const mutation = useMutation<RenameBudgetResult, Error, RenameBudgetParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, newName } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKey, {
          ...previousData,
          budget: {
            ...previousData.budget,
            name: newName.trim(),
          },
        })
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      const { budgetId, newName } = params
      const trimmedName = newName.trim()

      await writeBudgetData({
        budgetId,
        updates: { name: trimmedName },
        description: `renaming budget to "${trimmedName}"`,
      })

      return { newName: trimmedName }
    },

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const renameBudget = {
    mutate: (params: RenameBudgetParams) => mutation.mutate(params),
    mutateAsync: (params: RenameBudgetParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { renameBudget }
}
