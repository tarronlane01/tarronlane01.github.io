/**
 * Delete Account Mutation (Soft-Delete)
 *
 * Sets is_deleted and deleted_year_month on the account instead of removing the key.
 * This preserves the account name and historical balance entries for past months.
 * Also clears default flags so no code tries to use a deleted account as default.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@budget/data/queryKeys'
import type { BudgetData } from '@budget/data/queries/budget'
import { useBudget } from '@budget/contexts'
import { useBudgetMutationHelpers } from '../mutationHelpers'
import { softDeleteBudgetAccount } from '../writeBudgetData'
import { getYearMonthOrdinal } from '@utils'

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
  const { currentViewingDocument, currentYear, currentMonthNumber } = useBudget()
  const { updateBudgetCacheAndTrack } = useBudgetMutationHelpers()

  const mutation = useMutation<void, Error, DeleteAccountParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, accountId } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)
      const isCurrentDocument = currentViewingDocument.type === 'budget'
      const deletedYearMonth = getYearMonthOrdinal(currentYear, currentMonthNumber)

      if (previousData?.accounts && accountId in previousData.accounts) {
        const updatedAccount = {
          ...previousData.accounts[accountId],
          is_deleted: true,
          deleted_year_month: deletedYearMonth,
          is_income_default: false,
          is_outgo_default: false,
        }
        const updatedAccounts = {
          ...previousData.accounts,
          [accountId]: updatedAccount,
        }
        const updatedBudget: BudgetData = {
          ...previousData,
          accounts: updatedAccounts,
          budget: {
            ...previousData.budget,
            accounts: updatedAccounts,
          },
        }
        queryClient.setQueryData<BudgetData>(queryKey, updatedBudget)
        if (!isCurrentDocument) {
          updateBudgetCacheAndTrack(budgetId, updatedBudget)
        }
      }

      if (isCurrentDocument) {
        try {
          await softDeleteBudgetAccount(budgetId, accountId, deletedYearMonth, 'accounts: soft-delete (set is_deleted flag)')
        } catch (error) {
          console.warn('[useDeleteAccount] Failed to soft-delete account:', error)
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
