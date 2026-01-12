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

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useUpdateAccountBalance() {
  const queryClient = useQueryClient()

  const mutation = useMutation<UpdateAccountBalanceResult, Error, UpdateAccountBalanceParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, accountId, delta } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache
      if (previousData?.accounts?.[accountId]) {
        const updatedAccounts = {
          ...previousData.accounts,
          [accountId]: {
            ...previousData.accounts[accountId],
            balance: previousData.accounts[accountId].balance + delta,
          },
        }

        queryClient.setQueryData<BudgetData>(queryKey, {
          ...previousData,
          accounts: updatedAccounts,
        })
      }

      return { previousData }
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
