/**
 * Delete Account Mutation
 *
 * Removes a single account from the budget document using Firestore's deleteField().
 * Only the account key is removed; no other document fields are touched.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { useBudget } from '@contexts'
import { useBudgetMutationHelpers } from '../mutationHelpers'
import { deleteBudgetAccountKey } from '../writeBudgetData'

// ============================================================================
// TYPES
// ============================================================================

interface DeleteAccountParams {
  budgetId: string
  accountId: string
}

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { updateBudgetCacheAndTrack } = useBudgetMutationHelpers()

  const mutation = useMutation<void, Error, DeleteAccountParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, accountId } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)
      const isCurrentDocument = currentViewingDocument.type === 'budget'

      if (previousData?.accounts && accountId in previousData.accounts) {
        const { [accountId]: _removed, ...rest } = previousData.accounts
        void _removed
        const updatedBudget: BudgetData = {
          ...previousData,
          accounts: rest,
          budget: {
            ...previousData.budget,
            accounts: rest,
          },
        }
        queryClient.setQueryData<BudgetData>(queryKey, updatedBudget)
        if (!isCurrentDocument) {
          updateBudgetCacheAndTrack(budgetId, updatedBudget)
        }
      }

      if (isCurrentDocument) {
        try {
          await deleteBudgetAccountKey(budgetId, accountId, 'accounts: delete (targeted key)')
        } catch (error) {
          console.warn('[useDeleteAccount] Failed to delete account key:', error)
        }
      }

      return { previousData }
    },

    mutationFn: async () => {
      return undefined
    },

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const deleteAccount = {
    mutate: (params: DeleteAccountParams) => mutation.mutate(params),
    mutateAsync: (params: DeleteAccountParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { deleteAccount }
}
