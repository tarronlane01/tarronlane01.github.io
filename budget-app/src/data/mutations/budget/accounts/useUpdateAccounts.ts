/**
 * Update Accounts Mutation
 *
 * Updates all accounts in the budget document.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 */

import { createOptimisticMutation } from '../../infrastructure'
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

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useUpdateAccountsInternal = createOptimisticMutation<
  UpdateAccountsParams,
  UpdateAccountsResult,
  BudgetData
>({
  optimisticUpdate: (params) => {
    const { budgetId, accounts } = params

    return {
      cacheKey: queryKeys.budget(budgetId),
      transform: (cachedData) => {
        if (!cachedData) {
          return cachedData as unknown as BudgetData
        }

        return {
          ...cachedData,
          accounts,
        }
      },
    }
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
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useUpdateAccounts() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useUpdateAccountsInternal()

  const updateAccounts = {
    mutate: (params: UpdateAccountsParams) => mutate(params),
    mutateAsync: (params: UpdateAccountsParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { updateAccounts }
}
