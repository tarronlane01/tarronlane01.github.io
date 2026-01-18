/**
 * Update Accounts Mutation
 *
 * Updates all accounts in the budget document.
 *
 * Uses React Query's native optimistic update pattern.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { AccountsMap } from '@types'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useBudgetMutationHelpers } from '../mutationHelpers'

// ============================================================================
// TYPES
// ============================================================================

interface UpdateAccountsParams {
  budgetId: string
  accounts: AccountsMap
}

interface UpdateAccountsResult {
  accounts: AccountsMap
}

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useUpdateAccounts() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateBudgetCacheAndTrack } = useBudgetMutationHelpers()

  const mutation = useMutation<UpdateAccountsResult, Error, UpdateAccountsParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, accounts } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache and track change automatically
      if (previousData) {
        const updatedBudget: BudgetData = {
          ...previousData,
          accounts,
        }
        updateBudgetCacheAndTrack(budgetId, updatedBudget)
      }

      // Save current document immediately if viewing budget settings
      const isCurrentDocument = currentViewingDocument.type === 'budget'

      if (isCurrentDocument) {
        try {
          await saveCurrentDocument(budgetId, 'budget')
        } catch (error) {
          console.warn('[useUpdateAccounts] Failed to save current document immediately:', error)
          // Continue even if immediate save fails - background save will handle it
        }
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      // NO Firestore write! Just return the cached data
      const { accounts } = params
      return { accounts }
    },

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const updateAccounts = {
    mutate: (params: UpdateAccountsParams) => mutation.mutate(params),
    mutateAsync: (params: UpdateAccountsParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { updateAccounts }
}
