/**
 * Income Mutations Hook
 *
 * Provides mutation functions for income transactions:
 * - Add income
 * - Update income
 * - Delete income
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readDoc, getMonthDocId } from '../firestore/operations'
import { queryKeys } from '../queryClient'
import type { MonthQueryData } from '../queries/useMonthQuery'
import type { MonthDocument, IncomeTransaction, AccountsMap } from '../../types/budget'
import type { AddIncomeParams, UpdateIncomeParams, DeleteIncomeParams } from './monthMutationTypes'
import { saveMonthToFirestore, updateAccountBalance, savePayeeIfNew, calculateAccountBalancesForMonth } from './monthMutationHelpers'
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

export function useIncomeMutations() {
  const queryClient = useQueryClient()

  const addIncome = useMutation({
    mutationFn: async (params: AddIncomeParams) => {
      const { budgetId, year, month, amount, accountId, date, payee, description } = params

      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>('months', monthDocId, 'PRE-EDIT-READ')
      if (!exists || !monthData) throw new Error('Month data not found in Firestore')

      const newIncome: IncomeTransaction = {
        id: `income_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount, account_id: accountId, date, created_at: new Date().toISOString(),
      }
      if (payee?.trim()) newIncome.payee = payee.trim()
      if (description) newIncome.description = description

      const updatedAccounts = await updateAccountBalance(budgetId, accountId, amount)
      const updatedIncome = [...(monthData.income || []), newIncome]

      let updatedMonth: MonthDocument = {
        ...monthData, income: updatedIncome,
        total_income: updatedIncome.reduce((sum, inc) => sum + inc.amount, 0),
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

      await markAllBalancesStaleInFirestore(budgetId, year, month, { includeCategoryBalances: false })
      return { updatedMonth, newIncome, updatedAccounts, updatedPayees }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, amount, accountId, date, payee, description } = params
      const { monthKey, budgetKey } = await cancelTransactionQueries(queryClient, budgetId, year, month)
      const { previousMonth, previousBudget } = getPreviousData(queryClient, monthKey, budgetKey)

      if (previousMonth) {
        const newIncome: IncomeTransaction = {
          id: `income_optimistic_${Date.now()}`, amount, account_id: accountId, date, created_at: new Date().toISOString(),
        }
        if (payee?.trim()) newIncome.payee = payee.trim()
        if (description) newIncome.description = description

        const updatedIncome = [...previousMonth.month.income, newIncome]
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: { ...previousMonth.month, income: updatedIncome, total_income: updatedIncome.reduce((sum, inc) => sum + inc.amount, 0) },
        })
      }

      updateAccountBalanceInCache(queryClient, budgetKey, previousBudget, accountId, amount)
      markAllBalancesStaleInCache(budgetId, year, month, { includeCategoryBalances: false })
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

  const updateIncome = useMutation({
    mutationFn: async (params: UpdateIncomeParams) => {
      const { budgetId, year, month, incomeId, amount, accountId, date, payee, description, oldAmount, oldAccountId } = params

      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>('months', monthDocId, 'PRE-EDIT-READ')
      if (!exists || !monthData) throw new Error('Month data not found in Firestore')

      let updatedAccounts: AccountsMap | null = null
      if (accountId !== oldAccountId) {
        await updateAccountBalance(budgetId, oldAccountId, -oldAmount)
        updatedAccounts = await updateAccountBalance(budgetId, accountId, amount)
      } else if (amount !== oldAmount) {
        updatedAccounts = await updateAccountBalance(budgetId, accountId, amount - oldAmount)
      } else {
        const { data: budgetData } = await readDoc<{ accounts: AccountsMap }>('budgets', budgetId, 'reading accounts')
        if (budgetData?.accounts) updatedAccounts = budgetData.accounts
      }

      const updatedIncome: IncomeTransaction = {
        id: incomeId, amount, account_id: accountId, date,
        created_at: (monthData.income || []).find(i => i.id === incomeId)?.created_at || new Date().toISOString(),
      }
      if (payee?.trim()) updatedIncome.payee = payee.trim()
      if (description) updatedIncome.description = description

      const updatedIncomeList = (monthData.income || []).map(inc => inc.id === incomeId ? updatedIncome : inc)

      let updatedMonth: MonthDocument = {
        ...monthData, income: updatedIncomeList,
        total_income: updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0),
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

      await markAllBalancesStaleInFirestore(budgetId, year, month, { includeCategoryBalances: false })
      return { updatedMonth, updatedAccounts, updatedPayees }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, incomeId, amount, accountId, date, payee, description, oldAmount, oldAccountId } = params
      const { monthKey, budgetKey } = await cancelTransactionQueries(queryClient, budgetId, year, month)
      const { previousMonth, previousBudget } = getPreviousData(queryClient, monthKey, budgetKey)

      if (previousMonth) {
        const updatedIncome: IncomeTransaction = {
          id: incomeId, amount, account_id: accountId, date,
          created_at: previousMonth.month.income.find(i => i.id === incomeId)?.created_at || new Date().toISOString(),
        }
        if (payee?.trim()) updatedIncome.payee = payee.trim()
        if (description) updatedIncome.description = description

        const updatedIncomeList = previousMonth.month.income.map(inc => inc.id === incomeId ? updatedIncome : inc)
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: { ...previousMonth.month, income: updatedIncomeList, total_income: updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0) },
        })
      }

      handleAccountChangeInCache(queryClient, budgetKey, previousBudget, oldAccountId, accountId, oldAmount, amount, true)
      markAllBalancesStaleInCache(budgetId, year, month, { includeCategoryBalances: false })
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

  const deleteIncome = useMutation({
    mutationFn: async (params: DeleteIncomeParams) => {
      const { budgetId, year, month, incomeId, amount, accountId } = params

      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>('months', monthDocId, 'PRE-EDIT-READ')
      if (!exists || !monthData) throw new Error('Month data not found in Firestore')

      const updatedAccounts = await updateAccountBalance(budgetId, accountId, -amount)
      const updatedIncomeList = (monthData.income || []).filter(inc => inc.id !== incomeId)

      let updatedMonth: MonthDocument = {
        ...monthData, income: updatedIncomeList,
        total_income: updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0),
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
      await markAllBalancesStaleInFirestore(budgetId, year, month, { includeCategoryBalances: false })
      return { updatedMonth, updatedAccounts }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, incomeId, amount, accountId } = params
      const { monthKey, budgetKey } = await cancelTransactionQueries(queryClient, budgetId, year, month)
      const { previousMonth, previousBudget } = getPreviousData(queryClient, monthKey, budgetKey)

      if (previousMonth) {
        const updatedIncomeList = previousMonth.month.income.filter(inc => inc.id !== incomeId)
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: { ...previousMonth.month, income: updatedIncomeList, total_income: updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0) },
        })
      }

      updateAccountBalanceInCache(queryClient, budgetKey, previousBudget, accountId, -amount)
      markAllBalancesStaleInCache(budgetId, year, month, { includeCategoryBalances: false })
      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      queryClient.setQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month), { month: data.updatedMonth })
      updateAccountsFromServer(queryClient, budgetId, data.updatedAccounts)
    },
    onError: (_err, params, context) => rollbackOnError(queryClient, params.budgetId, params.year, params.month, context),
  })

  return { addIncome, updateIncome, deleteIncome }
}
