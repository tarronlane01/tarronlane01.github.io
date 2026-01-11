/**
 * Update Account Balance Mutation
 *
 * Updates a single account's balance by a delta amount.
 * Used after income/expense changes to adjust account balances.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 *
 * NOTE: This operation requires a read because we need the current balance
 * to compute the new value (current + delta). The entire accounts map is
 * written to preserve the nested structure.
 *
 * TODO: Consider using FieldValue.increment() for atomic increments.
 */

import { createOptimisticMutation } from '../../infrastructure'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { writeBudgetData, readBudgetForEdit } from '../writeBudgetData'

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

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useUpdateAccountBalanceInternal = createOptimisticMutation<
  UpdateAccountBalanceParams,
  UpdateAccountBalanceResult,
  BudgetData
>({
  optimisticUpdate: (params) => {
    const { budgetId, accountId, delta } = params

    return {
      cacheKey: queryKeys.budget(budgetId),
      transform: (cachedData) => {
        if (!cachedData?.accounts?.[accountId]) {
          return cachedData as BudgetData
        }

        const updatedAccounts = {
          ...cachedData.accounts,
          [accountId]: {
            ...cachedData.accounts[accountId],
            balance: cachedData.accounts[accountId].balance + delta,
          },
        }

        return {
          ...cachedData,
          accounts: updatedAccounts,
        }
      },
    }
  },

  mutationFn: async (params) => {
    const { budgetId, accountId, delta } = params

    // Read required: need current balance to compute new value (balance + delta)
    // TODO: Could use FieldValue.increment() for atomic increment
    const freshData = await readBudgetForEdit(budgetId, 'update account balance (delta)')
    const accounts = freshData.accounts || {}

    if (!accounts[accountId]) {
      throw new Error('Account not found')
    }

    const newBalance = accounts[accountId].balance + delta
    const updatedAccounts = {
      ...accounts,
      [accountId]: {
        ...accounts[accountId],
        balance: newBalance,
      },
    }

    await writeBudgetData({
      budgetId,
      updates: { accounts: updatedAccounts },
      description: 'saving updated account balance',
    })

    return { accountId, newBalance }
  },
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useUpdateAccountBalance() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useUpdateAccountBalanceInternal()

  const updateAccountBalance = {
    mutate: (params: UpdateAccountBalanceParams) => mutate(params),
    mutateAsync: (params: UpdateAccountBalanceParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { updateAccountBalance }
}
