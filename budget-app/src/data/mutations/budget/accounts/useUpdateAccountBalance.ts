/**
 * Update Account Balance Mutation
 *
 * Updates a single account's balance by a delta amount.
 * Used after income/expense changes to adjust account balances.
 *
 * Uses React Query's native optimistic update pattern.
 *
 * NOTE: This operation requires a read because we need the current balance
 * to compute the new value (current + delta). The entire accounts map is
 * written to preserve the nested structure.
 *
 * TODO: Consider using FieldValue.increment() for atomic increments.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useBudgetMutationHelpers } from '../mutationHelpers'

// ============================================================================
// TYPES
// ============================================================================

interface UpdateAccountBalanceParams {
  budgetId: string
  accountId: string
  delta: number
}

interface UpdateAccountBalanceResult {
  accountId: string
  newBalance: number
}

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useUpdateAccountBalance() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateBudgetCacheAndTrack } = useBudgetMutationHelpers()

  const mutation = useMutation<UpdateAccountBalanceResult, Error, UpdateAccountBalanceParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, accountId, delta } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache and track change automatically
      let newBalance = 0
      if (previousData?.accounts?.[accountId]) {
        newBalance = previousData.accounts[accountId].balance + delta
        const updatedAccounts = {
          ...previousData.accounts,
          [accountId]: {
            ...previousData.accounts[accountId],
            balance: newBalance,
          },
        }

        const updatedBudget: BudgetData = {
          ...previousData,
          accounts: updatedAccounts,
        }
        updateBudgetCacheAndTrack(budgetId, updatedBudget)
      }

      // Save current document immediately if viewing budget settings
      const isCurrentDocument = currentViewingDocument.type === 'budget'

      if (isCurrentDocument) {
        try {
          await saveCurrentDocument(budgetId, 'budget')
        } catch (error) {
          console.warn('[useUpdateAccountBalance] Failed to save current document immediately:', error)
          // Continue even if immediate save fails - background save will handle it
        }
      }

      return { previousData, newBalance }
    },

    mutationFn: async (params, context) => {
      // NO Firestore write! Just return the cached data
      const { accountId } = params
      const newBalance = (context as any)?.newBalance ?? 0
      return { accountId, newBalance }
    },

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const updateAccountBalance = {
    mutate: (params: UpdateAccountBalanceParams) => mutation.mutate(params),
    mutateAsync: (params: UpdateAccountBalanceParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { updateAccountBalance }
}
