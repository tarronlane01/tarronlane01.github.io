/**
 * Update Account Groups Mutation
 *
 * Updates account groups in the budget document.
 *
 * Uses React Query's native optimistic update pattern.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { AccountGroupsMap } from '@types'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useBudgetMutationHelpers } from '../mutationHelpers'

// ============================================================================
// HELPERS
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

interface UpdateAccountGroupsParams {
  budgetId: string
  accountGroups: AccountGroupsMap
}

interface UpdateAccountGroupsResult {
  accountGroups: AccountGroupsMap
}

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useUpdateAccountGroups() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateBudgetCacheAndTrack } = useBudgetMutationHelpers()

  const mutation = useMutation<UpdateAccountGroupsResult, Error, UpdateAccountGroupsParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, accountGroups } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache and track change automatically
      if (previousData) {
        const updatedBudget: BudgetData = {
          ...previousData,
          accountGroups,
        }
        updateBudgetCacheAndTrack(budgetId, updatedBudget)
      }

      // Save current document immediately if viewing budget settings
      const isCurrentDocument = currentViewingDocument.type === 'budget'

      if (isCurrentDocument) {
        try {
          await saveCurrentDocument(budgetId, 'budget')
        } catch (error) {
          console.warn('[useUpdateAccountGroups] Failed to save current document immediately:', error)
          // Continue even if immediate save fails - background save will handle it
        }
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      // NO Firestore write! Just return the cached data
      const { accountGroups } = params
      return { accountGroups }
    },

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const updateAccountGroups = {
    mutate: (params: UpdateAccountGroupsParams) => mutation.mutate(params),
    mutateAsync: (params: UpdateAccountGroupsParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { updateAccountGroups }
}
