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
import { writeBudgetData } from '../writeBudgetData'

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

  const mutation = useMutation<UpdateAccountsResult, Error, UpdateAccountsParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, accounts } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKey, {
          ...previousData,
          accounts,
        })
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      const { budgetId, accounts } = params

      await writeBudgetData({
        budgetId,
        updates: { accounts },
        description: 'saving updated accounts (user edited account settings)',
      })

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
