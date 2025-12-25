/**
 * Account Mutations Hook
 *
 * Provides mutation functions for account-level changes:
 * - Update accounts
 * - Update account groups
 * - Update single account balance
 *
 * All mutations use optimistic updates and update the cache with server response.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/useBudgetQuery'
import type { AccountsMap, AccountGroupsMap } from '../../types/budget'
import { cleanAccountsForFirestore, readDoc, writeDoc, type FirestoreData } from '../firestore/operations'

/**
 * Clean account groups for Firestore
 */
function cleanAccountGroupsForFirestore(groups: AccountGroupsMap): FirestoreData {
  const cleaned: FirestoreData = {}
  Object.entries(groups).forEach(([groupId, group]) => {
    cleaned[groupId] = {
      name: group.name,
      sort_order: group.sort_order,
    }
    if (group.expected_balance !== undefined) cleaned[groupId].expected_balance = group.expected_balance
    if (group.on_budget !== undefined) cleaned[groupId].on_budget = group.on_budget
    if (group.is_active !== undefined) cleaned[groupId].is_active = group.is_active
  })
  return cleaned
}

interface UpdateAccountsParams {
  budgetId: string
  accounts: AccountsMap
}

interface UpdateAccountGroupsParams {
  budgetId: string
  accountGroups: AccountGroupsMap
}

interface UpdateAccountBalanceParams {
  budgetId: string
  accountId: string
  delta: number
}

/**
 * Hook providing mutation functions for account-level data
 */
export function useAccountMutations() {
  const queryClient = useQueryClient()

  /**
   * Update accounts in budget document
   */
  const updateAccounts = useMutation({
    mutationFn: async ({ budgetId, accounts }: UpdateAccountsParams) => {
      const { exists, data } = await readDoc<FirestoreData>(
        'budgets',
        budgetId,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      const cleanedAccounts = cleanAccountsForFirestore(accounts)

      await writeDoc(
        'budgets',
        budgetId,
        {
          ...data,
          accounts: cleanedAccounts,
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

  /**
   * Update account groups in budget document
   */
  const updateAccountGroups = useMutation({
    mutationFn: async ({ budgetId, accountGroups }: UpdateAccountGroupsParams) => {
      const { exists, data } = await readDoc<FirestoreData>(
        'budgets',
        budgetId,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      const cleanedGroups = cleanAccountGroupsForFirestore(accountGroups)

      await writeDoc(
        'budgets',
        budgetId,
        {
          ...data,
          account_groups: cleanedGroups,
        },
        'saving updated account groups (user edited group settings)'
      )

      return accountGroups
    },
    onMutate: async ({ budgetId, accountGroups }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          accountGroups,
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          accountGroups: data,
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  /**
   * Update a single account's balance (used after income/expense changes)
   */
  const updateAccountBalance = useMutation({
    mutationFn: async ({ budgetId, accountId, delta }: UpdateAccountBalanceParams) => {
      const { exists, data } = await readDoc<FirestoreData>(
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

      await writeDoc(
        'budgets',
        budgetId,
        {
          ...data,
          accounts: cleanAccountsForFirestore(updatedAccounts),
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

  return {
    updateAccounts,
    updateAccountGroups,
    updateAccountBalance,
  }
}

