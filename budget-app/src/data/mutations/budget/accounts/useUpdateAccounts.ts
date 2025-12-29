/**
 * Update Accounts Mutation
 *
 * Updates all accounts in the budget document.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { AccountsMap, FirestoreData } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'

interface UpdateAccountsParams {
  budgetId: string
  accounts: AccountsMap
}

export function useUpdateAccounts() {
  const queryClient = useQueryClient()

  const updateAccounts = useMutation({
    mutationFn: async ({ budgetId, accounts }: UpdateAccountsParams) => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      await writeDocByPath(
        'budgets',
        budgetId,
        {
          ...data,
          accounts,
        },
        'saving updated accounts (user edited account settings)'
      )

      return accounts
    },
    onMutate: async ({ budgetId, accounts }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          accounts,
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

  return { updateAccounts }
}

