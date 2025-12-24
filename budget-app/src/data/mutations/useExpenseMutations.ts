/**
 * Expense Mutations Hook
 *
 * Provides mutation functions for expense transactions:
 * - Add expense
 * - Update expense
 * - Delete expense
 *
 * All mutations use optimistic updates and update the cache with server response.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryClient'
import { readDoc, getMonthDocId } from '../firestore/operations'
import type { MonthQueryData } from '../queries/useMonthQuery'
import { markNextMonthSnapshotStaleInCache } from '../queries/useMonthQuery'
import type { BudgetData } from '../queries/useBudgetQuery'
import type { MonthDocument, ExpenseTransaction } from '../../types/budget'
import type { AddExpenseParams, UpdateExpenseParams, DeleteExpenseParams } from './monthMutationTypes'
import {
  saveMonthToFirestore,
  updateAccountBalance,
  savePayeeIfNew,
  // Cache-only helpers (for onMutate)
  markCategoryBalancesSnapshotStaleInCache,
  markMonthCategoryBalancesStaleInCache,
  markFutureMonthsCategoryBalancesStaleInCache,
  // Firestore-only helpers (for mutationFn)
  markCategoryBalancesSnapshotStaleInFirestore,
  markMonthCategoryBalancesStaleInFirestore,
  markFutureMonthsCategoryBalancesStaleInFirestore,
} from './monthMutationHelpers'

export function useExpenseMutations() {
  const queryClient = useQueryClient()

  /**
   * Add expense transaction
   *
   * CROSS-MONTH: Marks next month as stale (affects account balances and category balances)
   */
  const addExpense = useMutation({
    mutationFn: async (params: AddExpenseParams) => {
      const { budgetId, year, month, amount, categoryId, accountId, date, payee, description } = params

      // Read from Firestore (server truth), not cache
      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>(
        'months',
        monthDocId,
        'reading month before adding expense (need current state)'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      const newExpense: ExpenseTransaction = {
        id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        category_id: categoryId,
        account_id: accountId,
        date,
        created_at: new Date().toISOString(),
      }
      if (payee?.trim()) newExpense.payee = payee.trim()
      if (description) newExpense.description = description

      const updatedExpenses = [...(monthData.expenses || []), newExpense]
      const updatedMonth: MonthDocument = {
        ...monthData,
        expenses: updatedExpenses,
        total_expenses: updatedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)
      const updatedAccounts = await updateAccountBalance(budgetId, accountId, -amount) // Expenses reduce balance

      // Save payee if new - read existing payees from Firestore
      let updatedPayees: string[] | null = null
      if (payee?.trim()) {
        const { data: payeesDoc } = await readDoc<{ payees: string[] }>(
          'payees',
          budgetId,
          'checking existing payees to see if new payee should be added'
        )
        const existingPayees = payeesDoc?.payees || []
        updatedPayees = await savePayeeIfNew(budgetId, payee, existingPayees)
      }

      // Mark stale in Firestore: budget snapshot + this month + future months
      // (Cache already updated in onMutate)
      await markCategoryBalancesSnapshotStaleInFirestore(budgetId)
      await markMonthCategoryBalancesStaleInFirestore(budgetId, year, month)
      await markFutureMonthsCategoryBalancesStaleInFirestore(budgetId, year, month)

      return { updatedMonth, newExpense, updatedAccounts, updatedPayees }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, amount, categoryId, accountId, date, payee, description } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey: monthKey })
      await queryClient.cancelQueries({ queryKey: budgetKey })

      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)
      const previousBudget = queryClient.getQueryData<BudgetData>(budgetKey)

      if (previousMonth) {
        const newExpense: ExpenseTransaction = {
          id: `expense_optimistic_${Date.now()}`,
          amount,
          category_id: categoryId,
          account_id: accountId,
          date,
          created_at: new Date().toISOString(),
        }
        if (payee?.trim()) newExpense.payee = payee.trim()
        if (description) newExpense.description = description

        const updatedExpenses = [...(previousMonth.month.expenses || []), newExpense]
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            expenses: updatedExpenses,
            total_expenses: updatedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
          },
        })
      }

      if (previousBudget && previousBudget.accounts[accountId]) {
        queryClient.setQueryData<BudgetData>(budgetKey, {
          ...previousBudget,
          accounts: {
            ...previousBudget.accounts,
            [accountId]: {
              ...previousBudget.accounts[accountId],
              balance: previousBudget.accounts[accountId].balance - amount,
            },
          },
        })
      }

      // CROSS-MONTH: Mark next month as stale in cache immediately
      markNextMonthSnapshotStaleInCache(budgetId, year, month)
      // Mark stale in cache: budget snapshot + this month + future months
      markCategoryBalancesSnapshotStaleInCache(budgetId)
      markMonthCategoryBalancesStaleInCache(budgetId, year, month)
      markFutureMonthsCategoryBalancesStaleInCache(budgetId, year, month)

      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)
      const payeesKey = queryKeys.payees(budgetId)

      queryClient.setQueryData<MonthQueryData>(monthKey, { month: data.updatedMonth })

      if (data.updatedAccounts) {
        const currentBudget = queryClient.getQueryData<BudgetData>(budgetKey)
        if (currentBudget) {
          queryClient.setQueryData<BudgetData>(budgetKey, {
            ...currentBudget,
            accounts: data.updatedAccounts,
          })
        }
      }

      if (data.updatedPayees) {
        queryClient.setQueryData<string[]>(payeesKey, data.updatedPayees)
      }
    },
    onError: (_err, params, context) => {
      const { budgetId, year, month } = params
      if (context?.previousMonth) {
        queryClient.setQueryData(queryKeys.month(budgetId, year, month), context.previousMonth)
      }
      if (context?.previousBudget) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousBudget)
      }
    },
  })

  /**
   * Update expense transaction
   */
  const updateExpense = useMutation({
    mutationFn: async (params: UpdateExpenseParams) => {
      const { budgetId, year, month, expenseId, amount, categoryId, accountId, date, payee, description, oldAmount, oldAccountId } = params

      // Read from Firestore (server truth), not cache
      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>(
        'months',
        monthDocId,
        'reading month before updating expense (need current state)'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      const updatedExpense: ExpenseTransaction = {
        id: expenseId,
        amount,
        category_id: categoryId,
        account_id: accountId,
        date,
        created_at: monthData.expenses?.find(e => e.id === expenseId)?.created_at || new Date().toISOString(),
      }
      if (payee?.trim()) updatedExpense.payee = payee.trim()
      if (description) updatedExpense.description = description

      const updatedExpensesList = (monthData.expenses || []).map(exp =>
        exp.id === expenseId ? updatedExpense : exp
      )

      const updatedMonth: MonthDocument = {
        ...monthData,
        expenses: updatedExpensesList,
        total_expenses: updatedExpensesList.reduce((sum, exp) => sum + exp.amount, 0),
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)

      // Update account balances if changed
      let updatedAccounts = null
      if (accountId !== oldAccountId) {
        await updateAccountBalance(budgetId, oldAccountId, oldAmount) // Add back to old
        updatedAccounts = await updateAccountBalance(budgetId, accountId, -amount) // Remove from new
      } else if (amount !== oldAmount) {
        updatedAccounts = await updateAccountBalance(budgetId, accountId, oldAmount - amount) // Adjust difference
      }

      // Save payee if new - read existing payees from Firestore
      let updatedPayees: string[] | null = null
      if (payee?.trim()) {
        const { data: payeesDoc } = await readDoc<{ payees: string[] }>(
          'payees',
          budgetId,
          'checking existing payees to see if new payee should be added'
        )
        const existingPayees = payeesDoc?.payees || []
        updatedPayees = await savePayeeIfNew(budgetId, payee, existingPayees)
      }

      // Mark stale in Firestore: budget snapshot + this month + future months
      // (Cache already updated in onMutate)
      await markCategoryBalancesSnapshotStaleInFirestore(budgetId)
      await markMonthCategoryBalancesStaleInFirestore(budgetId, year, month)
      await markFutureMonthsCategoryBalancesStaleInFirestore(budgetId, year, month)

      return { updatedMonth, updatedAccounts, updatedPayees }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, expenseId, amount, categoryId, accountId, date, payee, description, oldAmount, oldAccountId } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey: monthKey })
      await queryClient.cancelQueries({ queryKey: budgetKey })

      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)
      const previousBudget = queryClient.getQueryData<BudgetData>(budgetKey)

      if (previousMonth) {
        const updatedExpense: ExpenseTransaction = {
          id: expenseId,
          amount,
          category_id: categoryId,
          account_id: accountId,
          date,
          created_at: previousMonth.month.expenses?.find(e => e.id === expenseId)?.created_at || new Date().toISOString(),
        }
        if (payee?.trim()) updatedExpense.payee = payee.trim()
        if (description) updatedExpense.description = description

        const updatedExpensesList = (previousMonth.month.expenses || []).map(exp =>
          exp.id === expenseId ? updatedExpense : exp
        )

        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            expenses: updatedExpensesList,
            total_expenses: updatedExpensesList.reduce((sum, exp) => sum + exp.amount, 0),
          },
        })
      }

      if (previousBudget) {
        const updatedAccounts = { ...previousBudget.accounts }
        if (accountId !== oldAccountId) {
          if (updatedAccounts[oldAccountId]) {
            updatedAccounts[oldAccountId] = {
              ...updatedAccounts[oldAccountId],
              balance: updatedAccounts[oldAccountId].balance + oldAmount,
            }
          }
          if (updatedAccounts[accountId]) {
            updatedAccounts[accountId] = {
              ...updatedAccounts[accountId],
              balance: updatedAccounts[accountId].balance - amount,
            }
          }
        } else if (amount !== oldAmount && updatedAccounts[accountId]) {
          updatedAccounts[accountId] = {
            ...updatedAccounts[accountId],
            balance: updatedAccounts[accountId].balance + (oldAmount - amount),
          }
        }
        queryClient.setQueryData<BudgetData>(budgetKey, {
          ...previousBudget,
          accounts: updatedAccounts,
        })
      }

      // CROSS-MONTH: Mark next month as stale in cache immediately
      markNextMonthSnapshotStaleInCache(budgetId, year, month)
      // Mark stale in cache: budget snapshot + this month + future months
      markCategoryBalancesSnapshotStaleInCache(budgetId)
      markMonthCategoryBalancesStaleInCache(budgetId, year, month)
      markFutureMonthsCategoryBalancesStaleInCache(budgetId, year, month)

      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)
      const payeesKey = queryKeys.payees(budgetId)

      queryClient.setQueryData<MonthQueryData>(monthKey, { month: data.updatedMonth })

      if (data.updatedAccounts) {
        const currentBudget = queryClient.getQueryData<BudgetData>(budgetKey)
        if (currentBudget) {
          queryClient.setQueryData<BudgetData>(budgetKey, {
            ...currentBudget,
            accounts: data.updatedAccounts,
          })
        }
      }

      if (data.updatedPayees) {
        queryClient.setQueryData<string[]>(payeesKey, data.updatedPayees)
      }
    },
    onError: (_err, params, context) => {
      const { budgetId, year, month } = params
      if (context?.previousMonth) {
        queryClient.setQueryData(queryKeys.month(budgetId, year, month), context.previousMonth)
      }
      if (context?.previousBudget) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousBudget)
      }
    },
  })

  /**
   * Delete expense transaction
   */
  const deleteExpense = useMutation({
    mutationFn: async (params: DeleteExpenseParams) => {
      const { budgetId, year, month, expenseId, amount, accountId } = params

      // Read from Firestore (server truth), not cache
      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>(
        'months',
        monthDocId,
        'reading month before deleting expense (need current state)'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      const updatedExpensesList = (monthData.expenses || []).filter(exp => exp.id !== expenseId)

      const updatedMonth: MonthDocument = {
        ...monthData,
        expenses: updatedExpensesList,
        total_expenses: updatedExpensesList.reduce((sum, exp) => sum + exp.amount, 0),
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)
      const updatedAccounts = await updateAccountBalance(budgetId, accountId, amount) // Add back to balance

      // Mark stale in Firestore: budget snapshot + this month + future months
      // (Cache already updated in onMutate)
      await markCategoryBalancesSnapshotStaleInFirestore(budgetId)
      await markMonthCategoryBalancesStaleInFirestore(budgetId, year, month)
      await markFutureMonthsCategoryBalancesStaleInFirestore(budgetId, year, month)

      return { updatedMonth, updatedAccounts }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, expenseId, amount, accountId } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey: monthKey })
      await queryClient.cancelQueries({ queryKey: budgetKey })

      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)
      const previousBudget = queryClient.getQueryData<BudgetData>(budgetKey)

      if (previousMonth) {
        const updatedExpensesList = (previousMonth.month.expenses || []).filter(exp => exp.id !== expenseId)
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            expenses: updatedExpensesList,
            total_expenses: updatedExpensesList.reduce((sum, exp) => sum + exp.amount, 0),
          },
        })
      }

      if (previousBudget && previousBudget.accounts[accountId]) {
        queryClient.setQueryData<BudgetData>(budgetKey, {
          ...previousBudget,
          accounts: {
            ...previousBudget.accounts,
            [accountId]: {
              ...previousBudget.accounts[accountId],
              balance: previousBudget.accounts[accountId].balance + amount,
            },
          },
        })
      }

      // CROSS-MONTH: Mark next month as stale in cache immediately
      markNextMonthSnapshotStaleInCache(budgetId, year, month)
      // Mark stale in cache: budget snapshot + this month + future months
      markCategoryBalancesSnapshotStaleInCache(budgetId)
      markMonthCategoryBalancesStaleInCache(budgetId, year, month)
      markFutureMonthsCategoryBalancesStaleInCache(budgetId, year, month)

      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      queryClient.setQueryData<MonthQueryData>(monthKey, { month: data.updatedMonth })

      if (data.updatedAccounts) {
        const currentBudget = queryClient.getQueryData<BudgetData>(budgetKey)
        if (currentBudget) {
          queryClient.setQueryData<BudgetData>(budgetKey, {
            ...currentBudget,
            accounts: data.updatedAccounts,
          })
        }
      }
    },
    onError: (_err, params, context) => {
      const { budgetId, year, month } = params
      if (context?.previousMonth) {
        queryClient.setQueryData(queryKeys.month(budgetId, year, month), context.previousMonth)
      }
      if (context?.previousBudget) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousBudget)
      }
    },
  })

  return {
    addExpense,
    updateExpense,
    deleteExpense,
  }
}

