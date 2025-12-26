/**
 * Expense Mutations Hook
 *
 * Provides mutation functions for expense transactions:
 * - Add expense
 * - Update expense
 * - Delete expense
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryClient'
import { readDoc, getMonthDocId } from '../firestore/operations'
import type { MonthQueryData } from '../queries/useMonthQuery'
import type { MonthDocument, ExpenseTransaction, AccountsMap } from '../../types/budget'
import type { AddExpenseParams, UpdateExpenseParams, DeleteExpenseParams } from './monthMutationTypes'
import {
  saveMonthToFirestore,
  updateAccountBalance,
  savePayeeIfNew,
  calculateAccountBalancesForMonth,
} from './monthMutationHelpers'
import {
  cancelTransactionQueries,
  getPreviousData,
  markAllBalancesStaleInCache,
  markAllBalancesStaleInFirestore,
  updateAccountBalanceInCache,
  handleAccountChangeInCache,
  updateAccountsFromServer,
  rollbackOnError,
} from './transactionMutationHelpers'

export function useExpenseMutations() {
  const queryClient = useQueryClient()

  const addExpense = useMutation({
    mutationFn: async (params: AddExpenseParams) => {
      const { budgetId, year, month, amount, categoryId, accountId, date, payee, description, cleared } = params

      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>('months', monthDocId, 'PRE-EDIT-READ')
      if (!exists || !monthData) throw new Error('Month data not found in Firestore')

      const updatedAccounts = await updateAccountBalance(budgetId, accountId, -amount)

      const newExpense: ExpenseTransaction = {
        id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount, category_id: categoryId, account_id: accountId, date, created_at: new Date().toISOString(),
      }
      if (payee?.trim()) newExpense.payee = payee.trim()
      if (description) newExpense.description = description
      if (cleared !== undefined) newExpense.cleared = cleared

      const updatedExpenses = [...(monthData.expenses || []), newExpense]
      let updatedMonth: MonthDocument = {
        ...monthData, expenses: updatedExpenses,
        total_expenses: updatedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        updated_at: new Date().toISOString(),
      }

      if (updatedAccounts) {
        const accountIds = Object.keys(updatedAccounts)
        const accountCurrentBalances: Record<string, number> = {}
        accountIds.forEach(id => { accountCurrentBalances[id] = updatedAccounts[id].balance })
        const { accountBalancesEnd } = calculateAccountBalancesForMonth(updatedMonth, accountIds, accountCurrentBalances)
        updatedMonth = { ...updatedMonth, account_balances_end: accountBalancesEnd }
      }

      await saveMonthToFirestore(budgetId, updatedMonth)

      let updatedPayees: string[] | null = null
      if (payee?.trim()) {
        const { data: payeesDoc } = await readDoc<{ payees: string[] }>('payees', budgetId, 'checking payees')
        updatedPayees = await savePayeeIfNew(budgetId, payee, payeesDoc?.payees || [])
      }

      await markAllBalancesStaleInFirestore(budgetId, year, month)
      return { updatedMonth, newExpense, updatedAccounts, updatedPayees }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, amount, categoryId, accountId, date, payee, description, cleared } = params
      const { monthKey, budgetKey } = await cancelTransactionQueries(queryClient, budgetId, year, month)
      const { previousMonth, previousBudget } = getPreviousData(queryClient, monthKey, budgetKey)

      if (previousMonth) {
        const newExpense: ExpenseTransaction = {
          id: `expense_optimistic_${Date.now()}`, amount, category_id: categoryId,
          account_id: accountId, date, created_at: new Date().toISOString(),
        }
        if (payee?.trim()) newExpense.payee = payee.trim()
        if (description) newExpense.description = description
        if (cleared !== undefined) newExpense.cleared = cleared

        const updatedExpenses = [...(previousMonth.month.expenses || []), newExpense]
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: { ...previousMonth.month, expenses: updatedExpenses, total_expenses: updatedExpenses.reduce((sum, exp) => sum + exp.amount, 0) },
        })
      }

      updateAccountBalanceInCache(queryClient, budgetKey, previousBudget, accountId, -amount)
      markAllBalancesStaleInCache(budgetId, year, month)
      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      queryClient.setQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month), { month: data.updatedMonth })
      updateAccountsFromServer(queryClient, budgetId, data.updatedAccounts)
      if (data.updatedPayees) queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), data.updatedPayees)
    },
    onError: (_err, params, context) => rollbackOnError(queryClient, params.budgetId, params.year, params.month, context),
  })

  const updateExpense = useMutation({
    mutationFn: async (params: UpdateExpenseParams) => {
      const { budgetId, year, month, expenseId, amount, categoryId, accountId, date, payee, description, cleared, oldAmount, oldAccountId } = params

      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>('months', monthDocId, 'PRE-EDIT-READ')
      if (!exists || !monthData) throw new Error('Month data not found in Firestore')

      let updatedAccounts: AccountsMap | null = null
      if (accountId !== oldAccountId) {
        await updateAccountBalance(budgetId, oldAccountId, oldAmount)
        updatedAccounts = await updateAccountBalance(budgetId, accountId, -amount)
      } else if (amount !== oldAmount) {
        updatedAccounts = await updateAccountBalance(budgetId, accountId, oldAmount - amount)
      } else {
        const { data: budgetData } = await readDoc<{ accounts: AccountsMap }>('budgets', budgetId, 'reading accounts')
        if (budgetData?.accounts) updatedAccounts = budgetData.accounts
      }

      const updatedExpense: ExpenseTransaction = {
        id: expenseId, amount, category_id: categoryId, account_id: accountId, date,
        created_at: monthData.expenses?.find(e => e.id === expenseId)?.created_at || new Date().toISOString(),
      }
      if (payee?.trim()) updatedExpense.payee = payee.trim()
      if (description) updatedExpense.description = description
      if (cleared !== undefined) updatedExpense.cleared = cleared

      const updatedExpensesList = (monthData.expenses || []).map(exp => exp.id === expenseId ? updatedExpense : exp)
      let updatedMonth: MonthDocument = {
        ...monthData, expenses: updatedExpensesList,
        total_expenses: updatedExpensesList.reduce((sum, exp) => sum + exp.amount, 0),
        updated_at: new Date().toISOString(),
      }

      if (updatedAccounts) {
        const accountIds = Object.keys(updatedAccounts)
        const accountCurrentBalances: Record<string, number> = {}
        accountIds.forEach(id => { accountCurrentBalances[id] = updatedAccounts![id].balance })
        const { accountBalancesEnd } = calculateAccountBalancesForMonth(updatedMonth, accountIds, accountCurrentBalances)
        updatedMonth = { ...updatedMonth, account_balances_end: accountBalancesEnd }
      }

      await saveMonthToFirestore(budgetId, updatedMonth)

      let updatedPayees: string[] | null = null
      if (payee?.trim()) {
        const { data: payeesDoc } = await readDoc<{ payees: string[] }>('payees', budgetId, 'checking payees')
        updatedPayees = await savePayeeIfNew(budgetId, payee, payeesDoc?.payees || [])
      }

      await markAllBalancesStaleInFirestore(budgetId, year, month)
      return { updatedMonth, updatedAccounts, updatedPayees }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, expenseId, amount, categoryId, accountId, date, payee, description, cleared, oldAmount, oldAccountId } = params
      const { monthKey, budgetKey } = await cancelTransactionQueries(queryClient, budgetId, year, month)
      const { previousMonth, previousBudget } = getPreviousData(queryClient, monthKey, budgetKey)

      if (previousMonth) {
        const updatedExpense: ExpenseTransaction = {
          id: expenseId, amount, category_id: categoryId, account_id: accountId, date,
          created_at: previousMonth.month.expenses?.find(e => e.id === expenseId)?.created_at || new Date().toISOString(),
        }
        if (payee?.trim()) updatedExpense.payee = payee.trim()
        if (description) updatedExpense.description = description
        if (cleared !== undefined) updatedExpense.cleared = cleared

        const updatedExpensesList = (previousMonth.month.expenses || []).map(exp => exp.id === expenseId ? updatedExpense : exp)
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: { ...previousMonth.month, expenses: updatedExpensesList, total_expenses: updatedExpensesList.reduce((sum, exp) => sum + exp.amount, 0) },
        })
      }

      handleAccountChangeInCache(queryClient, budgetKey, previousBudget, oldAccountId, accountId, oldAmount, amount, false)
      markAllBalancesStaleInCache(budgetId, year, month)
      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      queryClient.setQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month), { month: data.updatedMonth })
      updateAccountsFromServer(queryClient, budgetId, data.updatedAccounts)
      if (data.updatedPayees) queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), data.updatedPayees)
    },
    onError: (_err, params, context) => rollbackOnError(queryClient, params.budgetId, params.year, params.month, context),
  })

  const deleteExpense = useMutation({
    mutationFn: async (params: DeleteExpenseParams) => {
      const { budgetId, year, month, expenseId, amount, accountId } = params

      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>('months', monthDocId, 'PRE-EDIT-READ')
      if (!exists || !monthData) throw new Error('Month data not found in Firestore')

      const updatedAccounts = await updateAccountBalance(budgetId, accountId, amount)
      const updatedExpensesList = (monthData.expenses || []).filter(exp => exp.id !== expenseId)

      let updatedMonth: MonthDocument = {
        ...monthData, expenses: updatedExpensesList,
        total_expenses: updatedExpensesList.reduce((sum, exp) => sum + exp.amount, 0),
        updated_at: new Date().toISOString(),
      }

      if (updatedAccounts) {
        const accountIds = Object.keys(updatedAccounts)
        const accountCurrentBalances: Record<string, number> = {}
        accountIds.forEach(id => { accountCurrentBalances[id] = updatedAccounts[id].balance })
        const { accountBalancesEnd } = calculateAccountBalancesForMonth(updatedMonth, accountIds, accountCurrentBalances)
        updatedMonth = { ...updatedMonth, account_balances_end: accountBalancesEnd }
      }

      await saveMonthToFirestore(budgetId, updatedMonth)
      await markAllBalancesStaleInFirestore(budgetId, year, month)
      return { updatedMonth, updatedAccounts }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, expenseId, amount, accountId } = params
      const { monthKey, budgetKey } = await cancelTransactionQueries(queryClient, budgetId, year, month)
      const { previousMonth, previousBudget } = getPreviousData(queryClient, monthKey, budgetKey)

      if (previousMonth) {
        const updatedExpensesList = (previousMonth.month.expenses || []).filter(exp => exp.id !== expenseId)
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: { ...previousMonth.month, expenses: updatedExpensesList, total_expenses: updatedExpensesList.reduce((sum, exp) => sum + exp.amount, 0) },
        })
      }

      updateAccountBalanceInCache(queryClient, budgetKey, previousBudget, accountId, amount)
      markAllBalancesStaleInCache(budgetId, year, month)
      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      queryClient.setQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month), { month: data.updatedMonth })
      updateAccountsFromServer(queryClient, budgetId, data.updatedAccounts)
    },
    onError: (_err, params, context) => rollbackOnError(queryClient, params.budgetId, params.year, params.month, context),
  })

  return { addExpense, updateExpense, deleteExpense }
}
