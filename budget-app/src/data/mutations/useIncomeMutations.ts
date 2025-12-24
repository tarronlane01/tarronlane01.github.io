/**
 * Income Mutations Hook
 *
 * Provides mutation functions for income transactions:
 * - Add income
 * - Update income
 * - Delete income
 *
 * All mutations use optimistic updates and update the cache with server response.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readDoc, getMonthDocId } from '../firestore/operations'
import { queryKeys } from '../queryClient'
import type { MonthQueryData } from '../queries/useMonthQuery'
import { markNextMonthSnapshotStaleInCache } from '../queries/useMonthQuery'
import type { BudgetData } from '../queries/useBudgetQuery'
import type { MonthDocument, IncomeTransaction } from '../../types/budget'
import type { AddIncomeParams, UpdateIncomeParams, DeleteIncomeParams } from './monthMutationTypes'
import { saveMonthToFirestore, updateAccountBalance, savePayeeIfNew } from './monthMutationHelpers'

export function useIncomeMutations() {
  const queryClient = useQueryClient()

  /**
   * Add income transaction
   *
   * CROSS-MONTH: Marks next month as stale since income affects previousMonthIncome
   */
  const addIncome = useMutation({
    mutationFn: async (params: AddIncomeParams) => {
      const { budgetId, year, month, amount, accountId, date, payee, description } = params

      // Read from Firestore (server truth), not cache
      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>(
        'months',
        monthDocId,
        'reading month before adding income (need current state)'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      // Create new income transaction with server-generated ID
      const newIncome: IncomeTransaction = {
        id: `income_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        account_id: accountId,
        date,
        created_at: new Date().toISOString(),
      }
      if (payee?.trim()) newIncome.payee = payee.trim()
      if (description) newIncome.description = description

      // Build updated month
      const updatedIncome = [...(monthData.income || []), newIncome]
      const updatedMonth: MonthDocument = {
        ...monthData,
        income: updatedIncome,
        total_income: updatedIncome.reduce((sum, inc) => sum + inc.amount, 0),
        updated_at: new Date().toISOString(),
      }

      // Save to Firestore
      await saveMonthToFirestore(budgetId, updatedMonth)

      // Update account balance
      const updatedAccounts = await updateAccountBalance(budgetId, accountId, amount)

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

      return { updatedMonth, newIncome, updatedAccounts, updatedPayees }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, amount, accountId, date, payee, description } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey: monthKey })
      await queryClient.cancelQueries({ queryKey: budgetKey })

      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)
      const previousBudget = queryClient.getQueryData<BudgetData>(budgetKey)

      // Optimistic update - month
      if (previousMonth) {
        const newIncome: IncomeTransaction = {
          id: `income_optimistic_${Date.now()}`,
          amount,
          account_id: accountId,
          date,
          created_at: new Date().toISOString(),
        }
        if (payee?.trim()) newIncome.payee = payee.trim()
        if (description) newIncome.description = description

        const updatedIncome = [...previousMonth.month.income, newIncome]
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            income: updatedIncome,
            total_income: updatedIncome.reduce((sum, inc) => sum + inc.amount, 0),
          },
        })
      }

      // Optimistic update - account balance
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

      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)
      const payeesKey = queryKeys.payees(budgetId)

      // Update month cache with server response
      queryClient.setQueryData<MonthQueryData>(monthKey, { month: data.updatedMonth })

      // Update budget accounts if they changed
      if (data.updatedAccounts) {
        const currentBudget = queryClient.getQueryData<BudgetData>(budgetKey)
        if (currentBudget) {
          queryClient.setQueryData<BudgetData>(budgetKey, {
            ...currentBudget,
            accounts: data.updatedAccounts,
          })
        }
      }

      // Update payees if new one was added
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
   * Update income transaction
   *
   * CROSS-MONTH: Marks next month as stale if amount changed (affects total_income)
   */
  const updateIncome = useMutation({
    mutationFn: async (params: UpdateIncomeParams) => {
      const { budgetId, year, month, incomeId, amount, accountId, date, payee, description, oldAmount, oldAccountId } = params

      // Read from Firestore (server truth), not cache
      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>(
        'months',
        monthDocId,
        'reading month before updating income (need current state)'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      // Build updated income
      const updatedIncome: IncomeTransaction = {
        id: incomeId,
        amount,
        account_id: accountId,
        date,
        created_at: (monthData.income || []).find(i => i.id === incomeId)?.created_at || new Date().toISOString(),
      }
      if (payee?.trim()) updatedIncome.payee = payee.trim()
      if (description) updatedIncome.description = description

      const updatedIncomeList = (monthData.income || []).map(inc =>
        inc.id === incomeId ? updatedIncome : inc
      )

      const updatedMonth: MonthDocument = {
        ...monthData,
        income: updatedIncomeList,
        total_income: updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0),
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)

      // Update account balances if changed
      let updatedAccounts = null
      if (accountId !== oldAccountId) {
        await updateAccountBalance(budgetId, oldAccountId, -oldAmount)
        updatedAccounts = await updateAccountBalance(budgetId, accountId, amount)
      } else if (amount !== oldAmount) {
        updatedAccounts = await updateAccountBalance(budgetId, accountId, amount - oldAmount)
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

      return { updatedMonth, updatedAccounts, updatedPayees }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, incomeId, amount, accountId, date, payee, description, oldAmount, oldAccountId } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey: monthKey })
      await queryClient.cancelQueries({ queryKey: budgetKey })

      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)
      const previousBudget = queryClient.getQueryData<BudgetData>(budgetKey)

      if (previousMonth) {
        const updatedIncome: IncomeTransaction = {
          id: incomeId,
          amount,
          account_id: accountId,
          date,
          created_at: previousMonth.month.income.find(i => i.id === incomeId)?.created_at || new Date().toISOString(),
        }
        if (payee?.trim()) updatedIncome.payee = payee.trim()
        if (description) updatedIncome.description = description

        const updatedIncomeList = previousMonth.month.income.map(inc =>
          inc.id === incomeId ? updatedIncome : inc
        )

        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            income: updatedIncomeList,
            total_income: updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0),
          },
        })
      }

      if (previousBudget) {
        const updatedAccounts = { ...previousBudget.accounts }
        if (accountId !== oldAccountId) {
          if (updatedAccounts[oldAccountId]) {
            updatedAccounts[oldAccountId] = {
              ...updatedAccounts[oldAccountId],
              balance: updatedAccounts[oldAccountId].balance - oldAmount,
            }
          }
          if (updatedAccounts[accountId]) {
            updatedAccounts[accountId] = {
              ...updatedAccounts[accountId],
              balance: updatedAccounts[accountId].balance + amount,
            }
          }
        } else if (amount !== oldAmount && updatedAccounts[accountId]) {
          updatedAccounts[accountId] = {
            ...updatedAccounts[accountId],
            balance: updatedAccounts[accountId].balance + (amount - oldAmount),
          }
        }
        queryClient.setQueryData<BudgetData>(budgetKey, {
          ...previousBudget,
          accounts: updatedAccounts,
        })
      }

      // CROSS-MONTH: Mark next month as stale in cache immediately
      markNextMonthSnapshotStaleInCache(budgetId, year, month)

      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)
      const payeesKey = queryKeys.payees(budgetId)

      // Update month cache with server response
      queryClient.setQueryData<MonthQueryData>(monthKey, { month: data.updatedMonth })

      // Update budget accounts if they changed
      if (data.updatedAccounts) {
        const currentBudget = queryClient.getQueryData<BudgetData>(budgetKey)
        if (currentBudget) {
          queryClient.setQueryData<BudgetData>(budgetKey, {
            ...currentBudget,
            accounts: data.updatedAccounts,
          })
        }
      }

      // Update payees if new one was added
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
   * Delete income transaction
   *
   * CROSS-MONTH: Marks next month as stale since income affects previousMonthIncome
   */
  const deleteIncome = useMutation({
    mutationFn: async (params: DeleteIncomeParams) => {
      const { budgetId, year, month, incomeId, amount, accountId } = params

      // Read from Firestore (server truth), not cache
      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>(
        'months',
        monthDocId,
        'reading month before deleting income (need current state)'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      const updatedIncomeList = (monthData.income || []).filter(inc => inc.id !== incomeId)

      const updatedMonth: MonthDocument = {
        ...monthData,
        income: updatedIncomeList,
        total_income: updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0),
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)
      const updatedAccounts = await updateAccountBalance(budgetId, accountId, -amount)

      return { updatedMonth, updatedAccounts }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, incomeId, amount, accountId } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey: monthKey })
      await queryClient.cancelQueries({ queryKey: budgetKey })

      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)
      const previousBudget = queryClient.getQueryData<BudgetData>(budgetKey)

      if (previousMonth) {
        const updatedIncomeList = previousMonth.month.income.filter(inc => inc.id !== incomeId)
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            income: updatedIncomeList,
            total_income: updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0),
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
    addIncome,
    updateIncome,
    deleteIncome,
  }
}

