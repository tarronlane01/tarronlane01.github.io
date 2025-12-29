/**
 * Update Account Balance Mutation
 *
 * Updates a single account's balance by a delta amount.
 * Used after income/expense changes to adjust account balances.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { FirestoreData } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'

interface UpdateAccountBalanceParams {
  budgetId: string
  accountId: string
  delta: number
}

export function useUpdateAccountBalance() {
  const queryClient = useQueryClient()

  const updateAccountBalance = useMutation({
    mutationFn: async ({ budgetId, accountId, delta }: UpdateAccountBalanceParams) => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      const accounts = data.accounts || {}

      if (!accounts[accountId]) {
        throw new Error('Account not found')
      }

      const updatedAccounts = {
        ...accounts,
        [accountId]: {
          ...accounts[accountId],
          balance: accounts[accountId].balance + delta,
        },
      }

      await writeDocByPath(
        'budgets',
        budgetId,
        {
          ...data,
          accounts: updatedAccounts,
        },
        'saving updated account balance'
      )

      return updatedAccounts
    },
    onMutate: async ({ budgetId, accountId, delta }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData && previousData.accounts[accountId]) {
        const updatedAccounts = {
          ...previousData.accounts,
          [accountId]: {
            ...previousData.accounts[accountId],
            balance: previousData.accounts[accountId].balance + delta,
          },
        }
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          accounts: updatedAccounts,
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          accounts: data,
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  return { updateAccountBalance }
}

